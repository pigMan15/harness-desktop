"""Run Service — creates, lists, switches, pauses, and resumes workflow runs.

Architecture §3.4: 活动 Run 路由冻结 — 修改 workflow.yaml 只影响新 Run。
Architecture §6.1: create_run 只接受用户提供的 Intent/Risk，不提供自动分类参数。
"""

from datetime import datetime, timezone
from pathlib import Path
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
