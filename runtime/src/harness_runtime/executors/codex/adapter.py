"""Codex Executor Adapter — spawns Codex as a child process.

Architecture §5.2: probe returns path/version/capabilities with actionable diagnostics.
start sends current node context (role, rules, phase_dir).
cancel: graceful SIGTERM → timeout → SIGKILL.
recover: checks pid + start_time to prevent PID reuse.
"""

import asyncio
from typing import AsyncIterable, Optional

from ..base import ExecutorAdapter, ExecutorCapability, ExecutionEvent, ExecutionRequest
from .events import parse_codex_event
from .process import CodexProcess


class CodexAdapter(ExecutorAdapter):
    """Codex executor adapter — spawns Codex CLI as a subprocess.

    Architecture §5.2: Codex communicates via stdin JSON-RPC / stdout JSON events.
    """

    def __init__(self, codex_path: str = "codex"):
        self._codex_path = codex_path
        self._sessions: dict[str, CodexProcess] = {}

    async def probe(self) -> ExecutorCapability:
        import shutil
        codex = shutil.which(self._codex_path)
        if not codex:
            return ExecutorCapability(
                available=False,
                diagnostics=f"Codex CLI not found. Searched for: {self._codex_path!r}. "
                             "Install Codex or configure the path in Settings.",
            )
        try:
            proc = await asyncio.create_subprocess_exec(
                codex, "--version",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            version = stdout.decode().strip()
            return ExecutorCapability(
                available=True, path=codex, version=version,
                features=["output", "tool_call", "approval", "cancel"],
            )
        except Exception as e:
            return ExecutorCapability(
                available=False, path=codex,
                diagnostics=f"Codex probe failed: {e}",
            )

    async def start(self, request: ExecutionRequest) -> str:
        proc = CodexProcess(
            codex_path=self._codex_path,
            project_root=request.project_root,
            run_id=request.run_id,
            node_id=request.node_id,
            role_file=request.role_file,
            phase_dir=request.phase_dir,
        )
        session_id = await proc.start()
        self._sessions[session_id] = proc
        return session_id

    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        proc = self._sessions.get(session_id)
        if not proc:
            yield ExecutionEvent("error", 0, {"error": f"Session not found: {session_id}"})
            return
        async for raw in proc.stream_events():
            yield parse_codex_event(raw)

    async def respond(self, session_id: str, decision: dict) -> None:
        proc = self._sessions.get(session_id)
        if proc:
            await proc.send_decision(decision)

    async def cancel(self, session_id: str) -> None:
        proc = self._sessions.get(session_id)
        if proc:
            await proc.cancel()

    async def recover(self, session_id: str) -> Optional[dict]:
        proc = self._sessions.get(session_id)
        if proc and await proc.is_alive():
            return {"session_id": session_id, "status": "recovered", "pid": proc.pid}
        return None
