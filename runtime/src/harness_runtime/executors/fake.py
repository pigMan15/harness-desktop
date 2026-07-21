"""Fake Executor — scriptable for testing without real Codex.

Architecture §5.1: Fake Executor can be scripted for output, approvals,
failures, timeouts, and recovery. Used to verify Runtime↔UI integration.
"""

import asyncio
import uuid
from typing import AsyncIterable, Optional

from .base import ExecutorAdapter, ExecutorCapability, ExecutionEvent, ExecutionRequest


class FakeExecutor(ExecutorAdapter):
    """Scriptable fake executor for integration testing.

    Usage:
        fake = FakeExecutor()
        fake.script_output(["# Analysis", "```python\nprint('hello')\n```"])
        fake.script_approval("Allow executing print('hello')?")
        fake.script_failure(RuntimeError("simulated crash"))
        fake.script_timeout(5.0)
    """

    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._script: list[dict] = []
        self._script_index: int = 0

    def script_output(self, content: str, tool_name: str = "write_file"):
        """Add a scripted output event."""
        self._script.append({"type": "output", "content": content, "tool": tool_name})

    def script_tool_call(self, tool: str, params: dict):
        """Add a scripted tool call event."""
        self._script.append({"type": "tool_call", "tool": tool, "params": params})

    def script_approval(self, message: str, category: str = "command"):
        """Add a scripted approval request."""
        self._script.append({"type": "approval_required", "message": message, "category": category})

    def script_failure(self, error: Exception):
        """Add a scripted failure event."""
        self._script.append({"type": "error", "error": str(error)})

    def script_timeout(self, delay: float):
        """Add a scripted delay (simulates slow execution)."""
        self._script.append({"type": "delay", "seconds": delay})

    def reset_script(self):
        """Clear all scripted events."""
        self._script = []
        self._script_index = 0

    async def probe(self) -> ExecutorCapability:
        return ExecutorCapability(
            available=True,
            path="fake://executor",
            version="0.0.0-test",
            features=["output", "tool_call", "approval", "cancel", "recover"],
        )

    async def start(self, request: ExecutionRequest) -> str:
        session_id = f"fake-{uuid.uuid4().hex[:8]}"
        self._sessions[session_id] = {
            "request": request,
            "script_index": 0,
            "cancelled": False,
        }
        return session_id

    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        seq = 0
        for event in self._script:
            if self._sessions.get(session_id, {}).get("cancelled"):
                yield ExecutionEvent("error", seq, {"error": "cancelled"})
                return

            if event["type"] == "delay":
                await asyncio.sleep(event["seconds"])
                continue

            yield ExecutionEvent(event["type"], seq, {k: v for k, v in event.items() if k != "type"})
            seq += 1

        yield ExecutionEvent("exited", seq, {"code": 0})

    async def respond(self, session_id: str, decision: dict) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["last_decision"] = decision

    async def cancel(self, session_id: str) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["cancelled"] = True

    async def recover(self, session_id: str) -> Optional[dict]:
        if session_id in self._sessions:
            return {"session_id": session_id, "status": "recovered"}
        return None
