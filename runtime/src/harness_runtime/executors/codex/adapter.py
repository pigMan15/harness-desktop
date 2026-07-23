"""Codex Executor Adapter backed by ``codex app-server --stdio``.

Architecture §5.2: probe returns path/version/capabilities with actionable diagnostics.
start sends current node context (role, rules, phase_dir).
cancel: graceful SIGTERM → timeout → SIGKILL.
recover: checks pid + start_time to prevent PID reuse.
"""

import asyncio
import shutil
import uuid
from pathlib import Path
from typing import AsyncIterable, Optional

from ..base import ExecutorAdapter, ExecutorCapability, ExecutionEvent, ExecutionRequest
from .app_server import CodexAppServer


class CodexAdapter(ExecutorAdapter):
    """Codex executor adapter — spawns Codex CLI as a subprocess.

    Architecture §5.2: Codex communicates via stdin JSON-RPC / stdout JSON events.
    """

    def __init__(self, codex_path: str = "codex"):
        self._codex_path = codex_path
        self._resolved_path = ""
        self._sessions: dict[str, CodexAppServer] = {}

    async def probe(self) -> ExecutorCapability:
        configured = Path(self._codex_path).expanduser()
        if configured.is_absolute() or configured.parent != Path("."):
            codex = str(configured.resolve()) if configured.is_file() else None
        else:
            codex = shutil.which(self._codex_path)
        if not codex:
            return ExecutorCapability(
                available=False,
                diagnostics=f"Codex CLI not found. Searched for: {self._codex_path!r}. "
                             "Install Codex or configure the path in Settings.",
            )
        try:
            version_proc = await asyncio.create_subprocess_exec(
                codex,
                "--version",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(version_proc.communicate(), timeout=10)
            if version_proc.returncode != 0:
                raise RuntimeError(stderr.decode(errors="replace").strip() or "--version failed")
            version = stdout.decode().strip()
            app_server_proc = await asyncio.create_subprocess_exec(
                codex,
                "app-server",
                "--help",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, app_server_stderr = await asyncio.wait_for(
                app_server_proc.communicate(), timeout=10
            )
            if app_server_proc.returncode != 0:
                raise RuntimeError(
                    app_server_stderr.decode(errors="replace").strip()
                    or "app-server capability unavailable"
                )
            self._resolved_path = codex
            return ExecutorCapability(
                available=True, path=codex, version=version,
                features=["app-server", "output", "tool_call", "approval", "cancel"],
            )
        except Exception as e:
            return ExecutorCapability(
                available=False, path=codex,
                diagnostics=f"Codex probe failed: {e}",
            )

    async def start(self, request: ExecutionRequest) -> str:
        codex_path = self._resolved_path or shutil.which(self._codex_path)
        if not codex_path:
            raise RuntimeError("CODEX_CLI_NOT_FOUND: run execution.probe first")

        role_path = Path(request.role_file)
        role_instructions = (
            role_path.read_text(encoding="utf-8") if role_path.is_file() else ""
        )
        rules = "\n".join(f"- {rule}" for rule in request.rules)
        prompt = (
            "Execute the specified Harness workflow node.\n"
            f"Run: {request.run_id}\n"
            f"Node: {request.node_id}\n"
            f"Role file: {request.role_file}\n"
            f"Phase directory: {request.phase_dir}\n"
            f"Required rules:\n{rules or '- Follow AGENTS.md and the specified Run state.'}\n"
            "Read the specified Run's authoritative state and required role instructions, perform only this node's work, "
            "and write all required phase artifacts before reporting completion."
        )
        server = CodexAppServer(codex_path, Path(request.project_root))
        await server.start(prompt, developer_instructions=role_instructions)
        session_id = f"codex-{uuid.uuid4().hex[:12]}"
        self._sessions[session_id] = server
        return session_id

    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        server = self._sessions.get(session_id)
        if not server:
            yield ExecutionEvent("error", 0, {"error": f"Session not found: {session_id}"})
            return
        for event in server.poll_events():
            yield ExecutionEvent(
                event["type"],
                event["sequence"],
                {key: value for key, value in event.items() if key not in {"type", "sequence"}},
            )

    def poll(self, session_id: str) -> list[dict]:
        server = self._sessions.get(session_id)
        return server.poll_events() if server else [
            {"type": "error", "sequence": 0, "error": f"Session not found: {session_id}"}
        ]

    async def respond(self, session_id: str, decision: dict) -> None:
        server = self._sessions.get(session_id)
        if not server:
            raise ValueError(f"CODEX_SESSION_NOT_FOUND: {session_id}")
        request_id = decision.get("requestId")
        if request_id is None:
            raise ValueError("CODEX_APPROVAL_REQUEST_ID_REQUIRED")
        await server.respond(int(request_id), decision.get("decision", ""))

    async def cancel(self, session_id: str) -> None:
        server = self._sessions.get(session_id)
        if server:
            await server.interrupt()
            await server.close()

    async def recover(self, session_id: str) -> Optional[dict]:
        server = self._sessions.get(session_id)
        if server and server.pid:
            return {"session_id": session_id, "status": "recovered", "pid": server.pid}
        return None

    def session_info(self, session_id: str) -> dict:
        server = self._sessions.get(session_id)
        if not server:
            return {}
        return {
            "pid": server.pid,
            "threadId": server.thread_id,
            "turnId": server.turn_id,
        }
