"""Recovery Service — recovers from Runtime crashes and interrupted sessions.

Architecture §16: on startup, scan registered projects, check state consistency,
probe orphan processes, recover or cleanup.

Does NOT auto-complete nodes or mark gates PASS.
"""

import os
import sys
from pathlib import Path
from typing import Optional

from ..persistence.audit import record_event
from ..persistence.database import get_db


class RecoveryResult:
    """Result of a recovery scan for one session."""

    def __init__(self, session_id: str, status: str, message: str):
        self.session_id = session_id
        self.status = status  # "recovered", "orphan_killed", "lost", "clean"
        self.message = message


def scan_sessions(project_id: Optional[str] = None) -> list[dict]:
    """Scan all executor sessions and determine recovery status."""
    from ..persistence.database import init_db
    init_db()
    db = get_db()
    if project_id:
        sessions = db.execute(
            "SELECT * FROM executor_sessions WHERE status = 'active' AND project_id = ?",
            (project_id,),
        ).fetchall()
    else:
        sessions = db.execute(
            "SELECT * FROM executor_sessions WHERE status = 'active'"
        ).fetchall()
    results = []
    for row in sessions:
        session_id = row["id"]
        pid = row["pid"]
        if pid and _is_process_alive(pid):
            results.append({
                "session_id": session_id,
                "status": "recoverable",
                "pid": pid,
                "node_id": row["node_id"],
                "run_id": row["run_id"],
                "project_id": row["project_id"],
                "worktree_path": row["worktree_path"],
                "branch_name": row["branch_name"],
                "thread_id": row["thread_id"],
                "turn_id": row["turn_id"],
            })
        elif pid:
            results.append({
                "session_id": session_id,
                "status": "orphan",
                "pid": pid,
                "node_id": row["node_id"],
                "run_id": row["run_id"],
                "project_id": row["project_id"],
                "worktree_path": row["worktree_path"],
                "branch_name": row["branch_name"],
                "thread_id": row["thread_id"],
                "turn_id": row["turn_id"],
                "message": "Process not found — may have exited",
            })
            db.execute(
                "UPDATE executor_sessions SET status = 'orphan' WHERE id = ?",
                (session_id,),
            )
        else:
            results.append({
                "session_id": session_id,
                "status": "lost",
                "node_id": row["node_id"],
                "run_id": row["run_id"],
                "project_id": row["project_id"],
                "worktree_path": row["worktree_path"],
                "branch_name": row["branch_name"],
                "thread_id": row["thread_id"],
                "turn_id": row["turn_id"],
                "message": "No PID recorded — session state unknown",
            })
            db.execute(
                "UPDATE executor_sessions SET status = 'lost' WHERE id = ?",
                (session_id,),
            )
    db.commit()
    return results


def cleanup_temp_files(project_root: Path) -> list[str]:
    """Clean up stale temporary files from interrupted operations.

    Architecture §16: stale tmp files from failed atomic writes.
    Does NOT auto-complete nodes.
    """
    cleaned = []
    harness = project_root / ".harness"
    for tmp in harness.glob(".tmp-*"):
        try:
            os.unlink(tmp)
            cleaned.append(str(tmp))
        except OSError:
            pass
    # Also clean lock files that are stale
    lock = harness / ".lock"
    if lock.exists():
        try:
            with open(lock) as f:
                pid_str = f.read().strip()
            pid = int(pid_str)
            if not _is_process_alive(pid):
                os.unlink(lock)
                cleaned.append(str(lock))
        except (ValueError, OSError):
            try:
                os.unlink(lock)
                cleaned.append(str(lock))
            except OSError:
                pass
    return cleaned


def verify_state_consistency(project_root: Path) -> dict:
    """Verify state.json is consistent with its snapshot.

    Architecture §16: check state vs snapshot, consistency, leftover temp files.
    """
    harness = project_root / ".harness"
    state_path = harness / "state.json"
    result = {"consistent": True, "issues": []}

    if not state_path.is_file():
        result["consistent"] = False
        result["issues"].append("state.json missing")
        return result

    import json
    try:
        state = json.load(open(state_path, encoding="utf-8"))
    except Exception as e:
        result["consistent"] = False
        result["issues"].append(f"state.json corrupt: {e}")
        return result

    run_id = state.get("run_id")
    if run_id:
        snapshot = harness / "runs" / run_id / "state.json"
        if snapshot.is_file():
            try:
                snap = json.load(open(snapshot, encoding="utf-8"))
                if snap.get("run_id") != run_id:
                    result["issues"].append("Snapshot run_id mismatch")
            except Exception as e:
                result["issues"].append(f"Snapshot corrupt: {e}")

    # Check for leftover temp files
    temps = list(harness.glob(".tmp-*"))
    if temps:
        result["issues"].append(f"Leftover temp files: {[t.name for t in temps]}")

    return result


def _is_process_alive(pid: int) -> bool:
    """Check if a process exists (cross-platform)."""
    if pid == os.getpid():
        return True
    if sys.platform == "win32":
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        ctypes.windll.kernel32.CloseHandle(handle)
        return True
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
