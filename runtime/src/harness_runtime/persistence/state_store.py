"""State Store — atomic, versioned reads and writes for .harness/state.json.

Architecture §10: 每次状态修改经过锁 + revision 比对 + 原子替换 + 快照。
并发冲突返回 REVISION_CONFLICT，不 last-write-wins。
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .atomic_files import atomic_read, atomic_write
from .project_lock import ProjectLock


def _revision(content: str) -> str:
    import hashlib

    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _run_state_path(project_root: Path, run_id: str) -> Path:
    return project_root / ".harness" / "runs" / run_id / "state.json"


def read_state(project_root: Path) -> tuple[dict, str]:
    """Read the current state.json and return (state_dict, revision_hash).

    Returns ({}, "") if state.json does not exist.
    """
    harness_dir = project_root / ".harness"
    state_path = harness_dir / "state.json"
    content = atomic_read(state_path)
    if not content:
        return {}, ""
    projection = json.loads(content)
    run_id = projection.get("run_id")
    if run_id:
        authoritative_content = atomic_read(_run_state_path(project_root, run_id))
        if authoritative_content:
            return json.loads(authoritative_content), _revision(authoritative_content)
    return projection, _revision(content)


def read_run_state(project_root: Path, run_id: str) -> tuple[dict, str]:
    """Read one Run's authoritative state without consulting UI selection."""
    content = atomic_read(_run_state_path(project_root, run_id))
    if not content:
        return {}, ""
    state = json.loads(content)
    worktree_content = _read_worktree_run_content(state, run_id)
    if worktree_content:
        worktree_state = json.loads(worktree_content)
        if worktree_state.get("run_id") == run_id and _worktree_state_is_newer(state, worktree_state):
            for key in ("branch_name", "worktree_path", "worktree_status"):
                if key not in worktree_state and state.get(key):
                    worktree_state[key] = state[key]
            worktree_content = json.dumps(worktree_state, ensure_ascii=False, indent=2) + "\n"
            _write_reconciled_run_state(project_root, run_id, worktree_content)
            return worktree_state, _revision(worktree_content)
    return state, _revision(content)


def _read_worktree_run_content(state: dict, run_id: str) -> str:
    worktree_path = state.get("worktree_path")
    if not worktree_path:
        return ""
    worktree_root = Path(str(worktree_path))
    candidates = [
        worktree_root / ".harness" / "runs" / run_id / "state.json",
        worktree_root / ".harness" / "state.json",
    ]
    candidates_with_state: list[tuple[str, dict]] = []
    for candidate in candidates:
        content = atomic_read(candidate)
        if not content:
            continue
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            continue
        if parsed.get("run_id") == run_id:
            candidates_with_state.append((content, parsed))
    if not candidates_with_state:
        return ""
    return max(candidates_with_state, key=lambda item: _state_progress_key(item[1]))[0]


def _worktree_state_is_newer(authoritative: dict, candidate: dict) -> bool:
    if candidate == authoritative:
        return False
    candidate_completed = len(candidate.get("completed_nodes", []) or [])
    authoritative_completed = len(authoritative.get("completed_nodes", []) or [])
    if candidate_completed != authoritative_completed:
        return candidate_completed > authoritative_completed
    terminal_states = {"DONE", "COMPLETED", "BLOCKED"}
    candidate_terminal = candidate.get("status") in terminal_states
    authoritative_terminal = authoritative.get("status") in terminal_states
    if candidate_terminal != authoritative_terminal:
        return candidate_terminal
    candidate_time = _parse_time(candidate.get("last_updated"))
    authoritative_time = _parse_time(authoritative.get("last_updated"))
    if candidate_time and authoritative_time:
        return candidate_time > authoritative_time
    if candidate_time and not authoritative_time:
        return True
    return False


def _state_progress_key(state: dict) -> tuple[int, int, float]:
    completed = len(state.get("completed_nodes", []) or [])
    terminal = 1 if state.get("status") in {"DONE", "COMPLETED", "BLOCKED"} else 0
    parsed = _parse_time(state.get("last_updated"))
    timestamp = parsed.timestamp() if parsed else 0.0
    return completed, terminal, timestamp


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _write_reconciled_run_state(project_root: Path, run_id: str, content: str) -> str:
    path = _run_state_path(project_root, run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    revision = atomic_write(path, content)
    projection_content = atomic_read(project_root / ".harness" / "state.json")
    if projection_content:
        projection = json.loads(projection_content)
        if projection.get("run_id") == run_id:
            atomic_write(project_root / ".harness" / "state.json", content)
    return revision


def write_selected_run_projection(
    project_root: Path, state: dict, expected_revision: Optional[str] = None
) -> str:
    """Write the rebuildable selected-Run projection; it never writes Run state."""
    state_path = project_root / ".harness" / "state.json"
    content = json.dumps(state, ensure_ascii=False, indent=2) + "\n"
    with ProjectLock(project_root) as _lock:
        current = atomic_read(state_path)
        if expected_revision is not None and current and _revision(current) != expected_revision:
            raise RuntimeError(
                f"REVISION_CONFLICT: expected {expected_revision[:12]}..., got {_revision(current)[:12]}..."
            )
        return atomic_write(state_path, content)


def write_run_state(
    project_root: Path,
    run_id: str,
    new_state: dict,
    expected_revision: Optional[str] = None,
    lock_timeout: float = 5.0,
    update_projection: bool = True,
) -> str:
    """Atomically write exactly one Run using its own lock and revision.

    并行 Run 只能竞争各自 ``runs/<run_id>/.lock``，根 state 只是选中 Run 的
    兼容投影，绝不能反向覆盖这里的权威状态。
    """
    if new_state.get("run_id") != run_id:
        raise ValueError("RUN_ID_STATE_MISMATCH")
    path = _run_state_path(project_root, run_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    new_state["last_updated"] = datetime.now(timezone.utc).isoformat()
    content = json.dumps(new_state, ensure_ascii=False, indent=2) + "\n"
    lock_path = path.parent / ".lock"
    with ProjectLock(project_root, timeout=lock_timeout, lockfile=lock_path):
        current = atomic_read(path)
        if expected_revision is not None and current and _revision(current) != expected_revision:
            raise RuntimeError(
                f"REVISION_CONFLICT: expected {expected_revision[:12]}..., got {_revision(current)[:12]}..."
            )
        revision = atomic_write(path, content)

    # Only mirror the currently selected Run. This is deliberately outside the
    # Run lock so unrelated Runs do not serialize their authoritative writes.
    if update_projection:
        projection_content = atomic_read(project_root / ".harness" / "state.json")
        if projection_content:
            projection = json.loads(projection_content)
            if projection.get("run_id") == run_id:
                write_selected_run_projection(project_root, new_state)
    return revision


def write_state(
    project_root: Path,
    new_state: dict,
    expected_revision: Optional[str] = None,
    lock_timeout: float = 5.0,
) -> str:
    """Write state.json atomically with revision check and snapshot.

    Architecture §10 steps:
    1. 获取项目独占锁
    2. 重新读取 state.json，与 expected_revision 比对
    3. 若冲突 → 返回 REVISION_CONFLICT 错误
    4. 写入同目录临时文件并 flush/fsync
    5. os.replace 原子替换
    6. 保存快照到 runs/<run-id>/state.json
    7. 释放锁（由 ProjectLock 上下文管理器保证）
    8. 返回新 revision hash

    Returns the new revision hash.
    Raises RuntimeError("REVISION_CONFLICT") if expected_revision doesn't match.
    Raises TimeoutError("PROJECT_LOCK_TIMEOUT") if lock cannot be acquired.
    """
    # Legacy callers may still write a root state. Migrate them to the Run
    # authority first, then replace only the compatibility projection.
    run_id = new_state.get("run_id")
    if run_id:
        existing, _ = read_run_state(project_root, run_id)
        run_revision = write_run_state(
            project_root,
            run_id,
            new_state,
            expected_revision=expected_revision if existing else None,
            lock_timeout=lock_timeout,
            update_projection=False,
        )
        write_selected_run_projection(project_root, new_state)
        return run_revision

    new_state["last_updated"] = datetime.now(timezone.utc).isoformat()
    return write_selected_run_projection(project_root, new_state, expected_revision)
