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
    return json.loads(content), _revision(content)


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
