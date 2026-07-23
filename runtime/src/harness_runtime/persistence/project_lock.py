"""Project-level file lock for serializing state mutations.

Architecture §10: 获取项目独占锁 → 读 revision → 校验 → 写 → 释放。
Windows: 使用 lockfile 方式（兼容性最好，不依赖 msvcrt）。
"""

import os
import sys
import time
from pathlib import Path


class ProjectLock:
    """A cooperative file lock for a project directory.

    Usage:
        lock = ProjectLock(project_path, timeout=5)
        with lock:
            # exclusive access to project state
            ...

    Architecture §10: 超时返回 PROJECT_LOCK_TIMEOUT。
    """

    def __init__(self, project_path: Path, timeout: float = 5.0, lockfile: Path | None = None):
        self._lockfile = lockfile or project_path / ".harness" / ".lock"
        self._timeout = timeout
        self._fd = None

    def acquire(self) -> bool:
        """Try to acquire the lock. Returns True on success, False on timeout."""
        self._lockfile.parent.mkdir(parents=True, exist_ok=True)
        deadline = time.monotonic() + self._timeout
        while time.monotonic() < deadline:
            try:
                # O_CREAT | O_EXCL — atomic create-if-not-exists
                self._fd = os.open(
                    str(self._lockfile),
                    os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                )
                # Write PID for diagnostics
                os.write(self._fd, str(os.getpid()).encode())
                return True
            except FileExistsError:
                # Lock held by another process — check if it's stale
                if self._is_stale():
                    self._break_stale_lock()
                    continue
                time.sleep(0.1)
        return False

    def release(self) -> None:
        """Release the lock."""
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None
        try:
            os.unlink(str(self._lockfile))
        except FileNotFoundError:
            pass

    def _is_stale(self) -> bool:
        """Check if the lock file is stale (process no longer exists)."""
        try:
            with open(self._lockfile, "r") as f:
                pid_str = f.read().strip()
            pid = int(pid_str)
            return not _process_exists(pid)
        except (FileNotFoundError, ValueError):
            return True

    def _break_stale_lock(self) -> None:
        """Remove a stale lock file."""
        try:
            os.unlink(str(self._lockfile))
        except FileNotFoundError:
            pass

    def __enter__(self):
        if not self.acquire():
            raise TimeoutError(f"PROJECT_LOCK_TIMEOUT: Could not acquire lock within {self._timeout}s")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
        return False


def _process_exists(pid: int) -> bool:
    """Probe a PID without sending a signal on Windows."""
    if pid == os.getpid():
        return True
    if sys.platform == "win32":
        import ctypes

        process_query_limited_information = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(
            process_query_limited_information, False, pid
        )
        if not handle:
            return False
        ctypes.windll.kernel32.CloseHandle(handle)
        return True
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
