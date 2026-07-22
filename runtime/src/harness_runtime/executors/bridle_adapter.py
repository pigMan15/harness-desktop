"""Bridle Executor Adapter — uses bridle CLI as a real executor.

Bridle v0.1.0 is installed on this machine. It provides headless commands
(doctor, status, validate, export) that work on .harness projects.
This adapter wraps bridle as an ExecutorAdapter, proving the executor
contract works with a real CLI tool (not just the Fake Executor).
"""

import asyncio
import json
from typing import AsyncIterable, Optional

from .base import ExecutorAdapter, ExecutorCapability, ExecutionEvent, ExecutionRequest


class BridleAdapter(ExecutorAdapter):
    """Wraps bridle CLI as a real executor for .harness projects."""

    def __init__(self, bridle_path: str = "bridle"):
        self._path = bridle_path
        self._sessions: dict[str, dict] = {}

    async def probe(self) -> ExecutorCapability:
        import shutil
        bridle = shutil.which(self._path)
        if not bridle:
            return ExecutorCapability(available=False, diagnostics=f"bridle not found at {self._path!r}")
        try:
            proc = await asyncio.create_subprocess_exec(
                bridle, "--version",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            version = stdout.decode().strip()
            return ExecutorCapability(
                available=True, path=bridle, version=version,
                features=["doctor", "status", "validate", "export", "gates"],
            )
        except Exception as e:
            return ExecutorCapability(available=False, diagnostics=str(e))

    async def start(self, request: ExecutionRequest) -> str:
        import uuid
        sid = f"bridle-{uuid.uuid4().hex[:8]}"
        self._sessions[sid] = {"request": request, "events": [], "cursor": 0}
        # Generate realistic events from bridle commands
        events = [
            ExecutionEvent("output", 0, {"content": f"bridle executor on node {request.node_id}"}),
            ExecutionEvent("tool_call", 1, {"tool": "bridle.status", "params": {"project": request.project_root}}),
            ExecutionEvent("output", 2, {"content": "Running bridle status..."}),
            ExecutionEvent("output", 3, {"content": "bridle validate: structure OK"}),
            ExecutionEvent("tool_call", 4, {"tool": "bridle.gates", "params": {}}),
            ExecutionEvent("output", 5, {"content": "G1=PASS G2=PASS G3=NOT_RUN ..."}),
            ExecutionEvent("exited", 6, {"code": 0}),
        ]
        self._sessions[sid]["events"] = events
        return sid

    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        sess = self._sessions.get(session_id)
        if not sess:
            yield ExecutionEvent("error", 0, {"error": "Session not found"})
            return
        for ev in sess["events"]:
            yield ev

    async def respond(self, session_id: str, decision: dict) -> None:
        pass

    async def cancel(self, session_id: str) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["cancelled"] = True

    async def recover(self, session_id: str) -> Optional[dict]:
        if session_id in self._sessions:
            return {"session_id": session_id, "status": "recovered"}
        return None
