"""State Store — atomic, versioned reads and writes for .harness/state.json.

Architecture §10: 每次状态修改经过锁 + revision 比对 + 原子替换 + 快照。
并发冲突返回 REVISION_CONFLICT，不 last-write-wins。
"""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .atomic_files import atomic_read, atomic_write
from .project_lock import ProjectLock


def read_state(project_root: Path) -> tuple[dict, str]:
    """Read the current state.json and return (state_dict, revision_hash).

    Returns ({}, "") if state.json does not exist.
    """
    harness_dir = project_root / ".harness"
    state_path = harness_dir / "state.json"
    content = atomic_read(state_path)
    if not content:
        return {}, ""
    import hashlib
    revision = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return json.loads(content), revision


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
    harness_dir = project_root / ".harness"
    state_path = harness_dir / "state.json"

    # Stamp last_updated
    new_state["last_updated"] = datetime.now(timezone.utc).isoformat()

    new_content = json.dumps(new_state, ensure_ascii=False, indent=2) + "\n"

    with ProjectLock(project_root, timeout=lock_timeout) as _lock:
        # Re-read and check revision
        current_content = atomic_read(state_path)
        if expected_revision is not None and current_content:
            import hashlib
            current_rev = hashlib.sha256(current_content.encode("utf-8")).hexdigest()
            if current_rev != expected_revision:
                raise RuntimeError(
                    f"REVISION_CONFLICT: expected {expected_revision[:12]}..., got {current_rev[:12]}..."
                )

        # Atomic write
        new_revision = atomic_write(state_path, new_content)

        # Save snapshot to runs/<run-id>/state.json
        run_id = new_state.get("run_id")
        if run_id:
            snapshot_dir = harness_dir / "runs" / run_id
            snapshot_dir.mkdir(parents=True, exist_ok=True)
            snapshot_path = snapshot_dir / "state.json"
            _ = atomic_write(snapshot_path, new_content)

        return new_revision
