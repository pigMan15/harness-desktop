"""Run Service — creates, lists, switches, pauses, and resumes workflow runs.

Architecture §3.4: 活动 Run 路由冻结 — 修改 workflow.yaml 只影响新 Run。
Architecture §6.1: create_run 只接受用户提供的 Intent/Risk，不提供自动分类参数。
"""

from datetime import datetime, timezone
from pathlib import Path
import subprocess
from typing import Optional

from ..persistence.state_store import (
    read_run_state,
    read_state,
    write_run_state,
    write_selected_run_projection,
)
from ..protocol.loader import load_workflow
from ..workflow.compiler import compile_workflow
from .identifiers import validate_run_id
from .worktrees import WorktreeUnavailable, ensure_run_worktree

VALID_INTENTS = {"UNKNOWN", "QUERY", "BUG_FIX", "FEATURE", "REFACTOR", "DEPLOYMENT", "INCIDENT"}
VALID_RISKS = {"UNKNOWN", "NA", "LOW", "MEDIUM", "HIGH"}


def create_run(
    project_root: Path,
    intent: str,
    risk: str,
    run_id: str,
    existing_runs: Optional[set[str]] = None,
) -> dict:
    """Create a new harness workflow run.

    Architecture §6.1: create_run 只接受用户提供的 Intent/Risk，不提供自动分类参数。
    Architecture §3.4: 编译后的路由写入 state.required_nodes，之后修改 workflow.yaml 只影响新 Run。

    Returns the initial state dict.
    Raises ValueError on invalid parameters.
    """
    # Validate intent/risk (user-specified only)
    if intent not in VALID_INTENTS:
        raise ValueError(f"Invalid intent: {intent!r}. Must be one of {VALID_INTENTS}")
    if risk not in VALID_RISKS:
        raise ValueError(f"Invalid risk: {risk!r}. Must be one of {VALID_RISKS}")

    # Validate run_id
    id_errors = validate_run_id(run_id, existing_runs)
    if id_errors:
        raise ValueError(f"Invalid run_id: {'; '.join(id_errors)}")

    # Compile the workflow to get required_nodes
    workflow = load_workflow(project_root)
    compiled = compile_workflow(workflow, intent, risk)

    phase_dir = f".harness/phases/{run_id}"

    state = {
        "schema_version": "1.0",
        "run_id": run_id,
        "status": "ROUTING",
        "intent": intent,
        "risk": risk,
        "current_node": compiled.required_nodes[0] if compiled.required_nodes else "INTAKE",
        "next_role": "dispatcher",
        "phase_dir": phase_dir,
        "required_nodes": compiled.required_nodes,
        "completed_nodes": [],
        "blocked_by": [],
        "artifacts": {},
        "gates": {
            "G1_REQUIREMENTS": "NOT_RUN",
            "G2_DESIGN": "NOT_RUN",
            "G3_COMPILE": "NOT_RUN",
            "G4_UNIT_TEST": "NOT_RUN",
            "G5_ATDD": "NOT_RUN",
            "G6_EVIDENCE": "NOT_RUN",
            "G7_PRERELEASE": "NOT_RUN",
            "G8_ACCEPTANCE": "NOT_RUN",
        },
        "retry_counts": {},
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "notes": f"Run created. Intent={intent}, Risk={risk}.",
    }
    return state


def list_runs(project_root: Path) -> list[dict]:
    """List complete run summaries and mark the active snapshot."""
    runs_dir = project_root / ".harness" / "runs"
    if not runs_dir.is_dir():
        return []
    active_state, _ = read_state(project_root)
    active_run_id = active_state.get("run_id")
    runs = []
    for d in sorted(runs_dir.iterdir(), reverse=True):
        snapshot = d / "state.json"
        if not d.is_dir() or not snapshot.is_file():
            continue
        try:
            state, revision = read_run_state(project_root, d.name)
        except (OSError, ValueError):
            continue
        runs.append(
            {
                "run_id": state.get("run_id", d.name),
                "intent": state.get("intent", ""),
                "risk": state.get("risk", ""),
                "status": state.get("status", ""),
                "current_node": state.get("current_node", ""),
                "next_role": state.get("next_role", ""),
                "completed_nodes": state.get("completed_nodes", []),
                "required_nodes": state.get("required_nodes", []),
                "blocked_by": state.get("blocked_by", []),
                "phase_dir": state.get("phase_dir", f".harness/phases/{d.name}"),
                "active": state.get("run_id", d.name) == active_run_id,
                "revision": revision,
                "branch_name": state.get("branch_name"),
                "worktree_path": state.get("worktree_path"),
                "worktree_status": state.get("worktree_status"),
                "merged_back": bool(state.get("merged_back", False)),
                "merged_target_branch": state.get("merged_target_branch"),
                "merged_commit": state.get("merged_commit"),
                "merged_at": state.get("merged_at"),
                "archived": bool(state.get("archived", False)),
                "archived_at": state.get("archived_at"),
            }
        )
    return runs


def create_run_and_activate(
    project_root: Path,
    intent: str,
    risk: str,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str]:
    """Create a run and atomically make it the active project state."""
    runs_dir = project_root / ".harness" / "runs"
    existing = {d.name for d in runs_dir.iterdir() if d.is_dir()} if runs_dir.is_dir() else set()
    state = create_run(project_root, intent, risk, run_id, existing)

    # phase_dir 必须与新 Run 同步建立，避免 UI 显示成功后执行节点却没有合法产物目录。
    phase_dir = project_root / state["phase_dir"]
    phase_dir.mkdir(parents=True, exist_ok=False)
    revision = write_run_state(project_root, run_id, state, update_projection=False)
    # 创建 Run 后选择它只更新根投影，权威 Run 文件不会被根状态反向覆盖。
    write_selected_run_projection(project_root, state, expected_revision=expected_revision)
    return state, revision


def switch_run(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str]:
    """Switch active state to a previously saved run snapshot."""
    runs_dir = project_root / ".harness" / "runs"
    snapshot = runs_dir / run_id / "state.json"
    if not snapshot.is_file():
        raise ValueError(f"Run snapshot not found: {run_id}")
    import json

    with open(snapshot, encoding="utf-8") as f:
        state = json.load(f)
    _, revision = read_run_state(project_root, run_id)
    if expected_revision is not None and expected_revision != revision:
        raise RuntimeError("REVISION_CONFLICT")
    write_selected_run_projection(project_root, state)
    return state, revision


def pause_run(state: dict) -> dict:
    """Pause a run (set status flag, does not skip nodes)."""
    state["status"] = "BLOCKED"
    if "user_paused" not in state["blocked_by"]:
        state["blocked_by"].append("user_paused")
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = "Run paused by user."
    return state


def resume_run(state: dict) -> dict:
    """Resume a paused run."""
    state["status"] = "IN_PROGRESS"
    state["blocked_by"] = [b for b in state.get("blocked_by", []) if b != "user_paused"]
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = "Run resumed by user."
    return state


def pause_active_run(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str]:
    """Pause the specified Run; selection is a UI concern, not a lock."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    paused = pause_run(state)
    revision = write_run_state(
        project_root,
        run_id,
        paused,
        expected_revision=expected_revision if expected_revision is not None else current_revision,
    )
    return paused, revision


def resume_active_run(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str]:
    """Resume the specified Run without advancing or completing a node."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    resumed = resume_run(state)
    revision = write_run_state(
        project_root,
        run_id,
        resumed,
        expected_revision=expected_revision if expected_revision is not None else current_revision,
    )
    return resumed, revision


def archive_run(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str]:
    """Archive an inactive Run without deleting its authoritative files."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    active_sessions = [
        session
        for session in state.get("terminal_sessions", {}).values()
        if session.get("status") in {"starting", "running"}
    ]
    if active_sessions:
        raise RuntimeError("RUN_ARCHIVE_ACTIVE_SESSION")
    if state.get("worktree_status") in {"ready", "active", "dirty"}:
        raise RuntimeError("RUN_ARCHIVE_UNMERGED_WORKTREE")

    state["archived"] = True
    state["archived_at"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = "Run archived by user; authoritative files retained."
    revision = write_run_state(
        project_root,
        run_id,
        state,
        expected_revision=(
            expected_revision if expected_revision is not None else current_revision
        ),
    )
    return state, revision



def preflight_run_merge_back(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> dict:
    """Inspect merge-back safety without changing HEAD, index, or worktree files."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        return _blocked_merge_preflight(
            run_id,
            current_revision,
            "RUN_NOT_FOUND",
            "Run does not exist",
            "Refresh Runs and select an existing Run.",
        )
    if expected_revision is not None and expected_revision != current_revision:
        return _blocked_merge_preflight(
            run_id,
            current_revision,
            "REVISION_CONFLICT",
            "Run changed after this page was loaded",
            "Refresh the preflight before merging.",
        )

    branch_name = str(state.get("branch_name") or "")
    worktree_path = Path(str(state.get("worktree_path") or ""))
    if not branch_name:
        return _blocked_merge_preflight(
            run_id,
            current_revision,
            "RUN_BRANCH_MISSING",
            "Run branch is unavailable",
            "Open the Run terminal and verify its Git branch metadata.",
        )
    if not worktree_path.is_dir():
        return _blocked_merge_preflight(
            run_id,
            current_revision,
            "RUN_WORKTREE_MISSING",
            "Run worktree is unavailable",
            "Restore or relocate the Run worktree before retrying.",
            [str(worktree_path)],
        )

    try:
        git_root = Path(_git(project_root, "rev-parse", "--show-toplevel").stdout.strip())
        target_branch = _git(git_root, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        if target_branch == "HEAD":
            return _blocked_merge_preflight(
                run_id,
                current_revision,
                "TARGET_BRANCH_DETACHED",
                "Target repository is in detached HEAD state",
                "Check out the intended target branch, then refresh.",
                branch_name=branch_name,
            )

        target_head = _git(git_root, "rev-parse", "HEAD").stdout.strip()
        run_head = _git(git_root, "rev-parse", branch_name).stdout.strip()
        target_status = _parse_git_status(_git(git_root, "status", "--short").stdout)
        run_status = _parse_git_status(_git(worktree_path, "status", "--short").stdout)
        counts = _git(
            git_root, "rev-list", "--left-right", "--count", f"{target_head}...{run_head}"
        ).stdout.replace("\t", " ").split()
        behind, ahead = (int(counts[0]), int(counts[1])) if len(counts) >= 2 else (0, 0)
        merge_base = _git(git_root, "merge-base", target_head, run_head).stdout.strip()
        fast_forward = merge_base == target_head
        commits = _parse_merge_commits(
            _git(
                git_root,
                "log",
                "--format=%H%x1f%s%x1f%an%x1f%aI",
                "-20",
                f"{target_head}..{run_head}",
            ).stdout
        )
        files = _parse_name_status(
            _git(git_root, "diff", "--name-status", f"{target_head}..{run_head}").stdout
        )
    except RuntimeError as exc:
        return _blocked_merge_preflight(
            run_id,
            current_revision,
            "GIT_PREFLIGHT_FAILED",
            "Git could not inspect this merge",
            "Review the technical details, repair the repository state, and refresh.",
            [str(exc)],
            branch_name=branch_name,
        )

    issues = []
    if target_status["total"]:
        issues.append(
            _merge_issue(
                "TARGET_WORKTREE_DIRTY",
                "Target worktree has local changes",
                "Commit or stash the target changes yourself, then refresh. Harness will not clean them automatically.",
                [entry["raw"] for entry in target_status["entries"]],
            )
        )
    if run_status["total"]:
        issues.append(
            _merge_issue(
                "RUN_WORKTREE_DIRTY",
                "Run worktree has uncommitted changes",
                "Open the Run terminal, review and commit the intended changes, then refresh.",
                [entry["raw"] for entry in run_status["entries"]],
            )
        )
    if ahead == 0:
        issues.append(
            _merge_issue(
                "NO_CHANGES_TO_MERGE",
                "The Run branch has no new commits",
                "Refresh the Run state or complete and commit the Run changes first.",
            )
        )
    elif not fast_forward:
        issues.append(
            _merge_issue(
                "NON_FAST_FORWARD",
                "Target and Run branches have diverged",
                "Resolve the branch relationship with Git yourself. Harness will not rebase or auto-resolve conflicts.",
                [f"Target-only commits: {behind}", f"Run-only commits: {ahead}"],
            )
        )

    file_summary = {"added": 0, "modified": 0, "deleted": 0, "renamed": 0, "other": 0}
    for entry in files["entries"]:
        key = {"A": "added", "M": "modified", "D": "deleted", "R": "renamed"}.get(
            entry["status"][:1], "other"
        )
        file_summary[key] += 1

    can_merge = not issues and fast_forward and ahead > 0
    return {
        "runId": run_id,
        "revision": current_revision,
        "status": "ready" if can_merge else "blocked",
        "canMerge": can_merge,
        "targetBranch": target_branch,
        "branchName": branch_name,
        "targetHead": target_head,
        "runHead": run_head,
        "ahead": ahead,
        "behind": behind,
        "fastForward": fast_forward,
        "targetStatus": target_status,
        "runStatus": run_status,
        "commits": commits,
        "files": files,
        "fileSummary": file_summary,
        "issues": issues,
    }


def _blocked_merge_preflight(
    run_id: str,
    revision: str,
    code: str,
    title: str,
    action: str,
    details: Optional[list[str]] = None,
    branch_name: str = "",
) -> dict:
    return {
        "runId": run_id,
        "revision": revision,
        "status": "blocked",
        "canMerge": False,
        "targetBranch": "",
        "branchName": branch_name,
        "targetHead": "",
        "runHead": "",
        "ahead": 0,
        "behind": 0,
        "fastForward": False,
        "targetStatus": {"total": 0, "entries": [], "truncated": False},
        "runStatus": {"total": 0, "entries": [], "truncated": False},
        "commits": [],
        "files": {"total": 0, "entries": [], "truncated": False},
        "fileSummary": {"added": 0, "modified": 0, "deleted": 0, "renamed": 0, "other": 0},
        "issues": [_merge_issue(code, title, action, details)],
    }


def _merge_issue(
    code: str,
    title: str,
    action: str,
    details: Optional[list[str]] = None,
) -> dict:
    return {
        "code": code,
        "severity": "blocking",
        "title": title,
        "description": action,
        "action": action,
        "details": details or [],
    }


def _parse_git_status(output: str, limit: int = 20) -> dict:
    lines = [line for line in output.splitlines() if line.strip()]
    entries = [
        {"status": line[:2].strip() or "?", "path": line[3:].strip(), "raw": line}
        for line in lines[:limit]
    ]
    return {"total": len(lines), "entries": entries, "truncated": len(lines) > limit}


def _parse_merge_commits(output: str) -> list[dict]:
    commits = []
    for line in output.splitlines():
        parts = line.split("\x1f")
        if len(parts) >= 4:
            commits.append(
                {"hash": parts[0], "subject": parts[1], "author": parts[2], "authoredAt": parts[3]}
            )
    return commits


def _parse_name_status(output: str, limit: int = 100) -> dict:
    lines = [line for line in output.splitlines() if line.strip()]
    entries = []
    for line in lines[:limit]:
        parts = line.split("\t")
        status = parts[0] if parts else "?"
        path = parts[-1] if len(parts) > 1 else line
        previous_path = parts[1] if status.startswith("R") and len(parts) > 2 else ""
        entries.append(
            {"status": status, "path": path, "previousPath": previous_path, "raw": line}
        )
    return {"total": len(lines), "entries": entries, "truncated": len(lines) > limit}

def merge_run_back(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> tuple[dict, str, dict]:
    """Fast-forward merge a Run branch/worktree back into the project branch."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    if expected_revision is not None and expected_revision != current_revision:
        raise RuntimeError("REVISION_CONFLICT")

    branch_name = str(state.get("branch_name") or "")
    worktree_path = Path(str(state.get("worktree_path") or ""))
    if not branch_name:
        raise RuntimeError("RUN_BRANCH_MISSING")
    if not worktree_path.is_dir():
        raise RuntimeError(f"RUN_WORKTREE_MISSING: {worktree_path}")

    git_root = _git(project_root, "rev-parse", "--show-toplevel").stdout.strip()
    target_branch = _git(Path(git_root), "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if target_branch == "HEAD":
        raise RuntimeError("TARGET_BRANCH_DETACHED")
    target_status = _git(Path(git_root), "status", "--short").stdout.strip()
    if target_status:
        raise RuntimeError(_dirty_worktree_message("TARGET_WORKTREE_DIRTY", target_status))
    run_status = _git(worktree_path, "status", "--short").stdout.strip()
    if run_status:
        raise RuntimeError(_dirty_worktree_message("RUN_WORKTREE_DIRTY", run_status))

    before = _git(Path(git_root), "rev-parse", "HEAD").stdout.strip()
    _git(Path(git_root), "merge", "--ff-only", branch_name)
    after = _git(Path(git_root), "rev-parse", "HEAD").stdout.strip()

    state["merged_back"] = True
    state["merged_target_branch"] = target_branch
    state["merged_commit"] = after
    state["merged_at"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = f"Run branch {branch_name} merged back to {target_branch} at {after[:12]}."
    revision = write_run_state(
        project_root,
        run_id,
        state,
        expected_revision=current_revision,
    )
    return state, revision, {
        "targetBranch": target_branch,
        "branchName": branch_name,
        "before": before,
        "after": after,
        "fastForward": before != after,
    }


def _dirty_worktree_message(code: str, status: str) -> str:
    lines = [line for line in status.splitlines() if line.strip()]
    shown = lines[:20]
    suffix = "" if len(lines) <= len(shown) else f"\n... and {len(lines) - len(shown)} more"
    return f"{code}:\n" + "\n".join(shown) + suffix


def get_execution_context(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> dict:
    """Return Runtime-authorized execution paths for one Run."""
    state, current_revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    if expected_revision is not None and expected_revision != current_revision:
        raise RuntimeError("REVISION_CONFLICT")
    if state.get("archived"):
        return _execution_context_result(
            project_root, state, current_revision, False, "RUN_ARCHIVED"
        )
    if state.get("status") == "BLOCKED" and "user_paused" in state.get("blocked_by", []):
        return _execution_context_result(
            project_root, state, current_revision, False, "RUN_PAUSED"
        )

    requires_worktree = "DEVELOPMENT" in state.get("required_nodes", [])
    if requires_worktree:
        try:
            # 代码修改型 Run 绝不回退到共享项目根目录；失败必须持久化为可诊断 BLOCKED。
            assigned = ensure_run_worktree(project_root, run_id)
            if any(state.get(key) != value for key, value in assigned.items()):
                state.update(assigned)
                current_revision = write_run_state(
                    project_root,
                    run_id,
                    state,
                    expected_revision=current_revision,
                )
        except WorktreeUnavailable as exc:
            reason = f"WORKTREE_UNAVAILABLE: {exc}"
            state["status"] = "BLOCKED"
            marker = f"worktree_unavailable:{exc}"
            if marker not in state.setdefault("blocked_by", []):
                state["blocked_by"].append(marker)
            state["worktree_status"] = "blocked"
            state["notes"] = reason
            current_revision = write_run_state(
                project_root,
                run_id,
                state,
                expected_revision=current_revision,
            )
            return _execution_context_result(
                project_root, state, current_revision, False, reason
            )

    execution_root = Path(state.get("worktree_path") or project_root).resolve()
    if not execution_root.is_dir():
        return _execution_context_result(
            project_root,
            state,
            current_revision,
            False,
            f"EXECUTION_ROOT_MISSING: {execution_root}",
        )
    return _execution_context_result(project_root, state, current_revision, True, "")


def _git(cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-c", "core.longpaths=true", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("GIT_EXECUTABLE_NOT_FOUND") from exc
    except subprocess.CalledProcessError as exc:
        message = (exc.stderr or exc.stdout or "git command failed").strip()
        raise RuntimeError(message) from exc


def _execution_context_result(
    project_root: Path,
    state: dict,
    revision: str,
    terminal_allowed: bool,
    block_reason: str,
) -> dict:
    execution_root = Path(state.get("worktree_path") or project_root).resolve()
    execution_root_text = (
        ""
        if not terminal_allowed and state.get("worktree_status") == "blocked"
        else str(execution_root)
    )
    return {
        "runId": state.get("run_id", ""),
        "revision": revision,
        "status": state.get("status", ""),
        "currentNode": state.get("current_node", ""),
        "nextRole": state.get("next_role", ""),
        "phaseDir": state.get("phase_dir", ""),
        "projectRoot": str(project_root.resolve()),
        "worktreePath": execution_root_text,
        "branchName": state.get("branch_name", ""),
        "terminalAllowed": terminal_allowed,
        "terminalBlockReason": block_reason,
    }
