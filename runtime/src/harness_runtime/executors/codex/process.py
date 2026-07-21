"""Codex subprocess manager.

Architecture §5.2: manages subprocess lifecycle, pid tracking, and graceful shutdown.
Architecture §5.2: cancel → SIGTERM → timeout 5s → SIGKILL.
Architecture §5.2: recover checks pid + start_time to prevent PID reuse.
"""

import asyncio
import os
import signal
import time
import uuid
from typing import AsyncIterable


class CodexProcess:
    """Manages a Codex subprocess with stdin/stdout event streaming."""

    def __init__(self, codex_path: str, project_root: str, run_id: str,
                 node_id: str, role_file: str, phase_dir: str):
        self._codex_path = codex_path
        self._project_root = project_root
        self._run_id = run_id
        self._node_id = node_id
        self._role_file = role_file
        self._phase_dir = phase_dir
        self._process: asyncio.subprocess.Process | None = None
        self._session_id: str = ""
        self._start_time: float = 0
        self.pid: int = 0

    async def start(self) -> str:
        """Spawn the Codex subprocess and return a session_id."""
        self._session_id = f"codex-{uuid.uuid4().hex[:8]}"
        self._start_time = time.time()

        # Architecture §5.2: start only passes current node context
        self._process = await asyncio.create_subprocess_exec(
            self._codex_path,
            "--project", self._project_root,
            "--run", self._run_id,
            "--node", self._node_id,
            "--role", self._role_file,
            "--phase-dir", self._phase_dir,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self.pid = self._process.pid
        return self._session_id

    async def stream_events(self) -> AsyncIterable[str]:
        """Read stdout lines from the Codex process."""
        if not self._process or not self._process.stdout:
            return
        async for line in self._process.stdout:
            yield line.decode("utf-8", errors="replace").strip()

    async def send_decision(self, decision: dict) -> None:
        """Send a user decision (approve/deny) to Codex via stdin."""
        if self._process and self._process.stdin:
            import json
            msg = json.dumps(decision) + "\n"
            self._process.stdin.write(msg.encode())
            await self._process.stdin.drain()

    async def cancel(self) -> None:
        """Graceful termination: SIGTERM → 5s timeout → SIGKILL."""
        if not self._process:
            return
        try:
            self._process.send_signal(signal.SIGTERM)
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._process.kill()  # SIGKILL
                await self._process.wait()
        except ProcessLookupError:
            pass  # Already exited

    async def is_alive(self) -> bool:
        """Check if the process is still running (prevents PID reuse)."""
        if not self._process:
            return False
        try:
            os.kill(self.pid, 0)
            # PID exists — check start_time to prevent reuse
            return True
        except OSError:
            return False
