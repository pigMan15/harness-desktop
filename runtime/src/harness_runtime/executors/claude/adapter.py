"""Claude Code adapter backed by non-interactive stream-json output."""

import asyncio
import json
import shutil
import uuid
from pathlib import Path
from typing import AsyncIterable, Optional

from ..base import ExecutorAdapter, ExecutorCapability, ExecutionEvent, ExecutionRequest


def events_from_message(payload: dict, sequence: int) -> tuple[list[dict], int]:
    """Convert one Claude stream-json object to the shared executor event model."""
    events: list[dict] = []

    def append(event_type: str, **data) -> None:
        nonlocal sequence
        sequence += 1
        events.append({"type": event_type, "sequence": sequence, **data})

    message_type = payload.get("type")
    if message_type == "assistant":
        message = payload.get("message") or {}
        for item in message.get("content") or []:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and item.get("text"):
                append("output", content=str(item["text"]))
            elif item.get("type") == "tool_use":
                append("tool_call", tool=str(item.get("name") or "tool"), params=item.get("input") or {})
    elif message_type == "result":
        if payload.get("result"):
            append("output", content=str(payload["result"]))
        append("exited", code=1 if payload.get("is_error") else 0, sessionId=payload.get("session_id"))
    elif message_type == "error":
        append("error", error=str(payload.get("error") or payload.get("message") or "Claude execution failed"))
    return events, sequence


class _ClaudeSession:
    def __init__(self, session_id: str, cwd: Path, system_prompt: str):
        self.session_id = session_id
        self.cwd = cwd
        self.system_prompt = system_prompt
        self.process: Optional[asyncio.subprocess.Process] = None
        self.events: list[dict] = []
        self.sequence = 0
        self.thread_id = ""
        self.tasks: list[asyncio.Task] = []
        self.terminal_emitted = False


class ClaudeAdapter(ExecutorAdapter):
    def __init__(self, claude_path: str = "claude"):
        self._claude_path = claude_path
        self._resolved_path = ""
        self._sessions: dict[str, _ClaudeSession] = {}

    async def probe(self) -> ExecutorCapability:
        configured = Path(self._claude_path).expanduser()
        if configured.is_absolute() or configured.parent != Path("."):
            executable = str(configured.resolve()) if configured.is_file() else None
        else:
            executable = shutil.which(self._claude_path)
        if not executable:
            return ExecutorCapability(False, diagnostics="Claude Code CLI not found. Configure it in Settings or use Claude Terminal after installation.")
        try:
            process = await asyncio.create_subprocess_exec(executable, "--version", stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
            if process.returncode != 0:
                raise RuntimeError(stderr.decode(errors="replace").strip() or "--version failed")
            self._resolved_path = executable
            return ExecutorCapability(
                True,
                path=executable,
                version=stdout.decode(errors="replace").strip(),
                features=["stream-json", "output", "tool_call", "cancel", "resume", "accept-edits"],
                diagnostics="Claude uses non-interactive acceptEdits mode; Codex-style per-tool approvals are not available.",
            )
        except Exception as exc:
            return ExecutorCapability(False, path=executable, diagnostics=f"Claude Code probe failed: {exc}")

    async def start(self, request: ExecutionRequest) -> str:
        role_path = Path(request.role_file)
        system_prompt = role_path.read_text(encoding="utf-8") if role_path.is_file() else ""
        rules = "\n".join(f"- {rule}" for rule in request.rules)
        prompt = (
            "Execute the specified Harness workflow node.\n"
            f"Run: {request.run_id}\nNode: {request.node_id}\nPhase directory: {request.phase_dir}\n"
            f"Required rules:\n{rules or '- Follow AGENTS.md and the authoritative run state.'}\n"
            "Perform only this node's work and write its required phase artifacts before reporting completion."
        )
        return await self.start_prompt(request.project_root, prompt, system_prompt)

    async def start_prompt(self, project_root: str, prompt: str, system_prompt: str = "") -> str:
        executable = self._resolved_path or shutil.which(self._claude_path)
        if not executable:
            raise RuntimeError("CLAUDE_CLI_NOT_FOUND: run execution.probe first")
        session_id = f"claude-{uuid.uuid4().hex[:12]}"
        session = _ClaudeSession(session_id, Path(project_root), system_prompt)
        self._sessions[session_id] = session
        await self._spawn(session, prompt, resume=False)
        return session_id

    async def _spawn(self, session: _ClaudeSession, prompt: str, resume: bool) -> None:
        args = ["--print", "--verbose", "--output-format", "stream-json", "--permission-mode", "acceptEdits"]
        if resume:
            if not session.thread_id:
                raise ValueError("CLAUDE_RESUME_SESSION_ID_MISSING")
            args.extend(["--resume", session.thread_id])
        elif session.system_prompt:
            args.extend(["--append-system-prompt", session.system_prompt])
        args.append(prompt)
        session.terminal_emitted = False
        session.process = await asyncio.create_subprocess_exec(
            self._resolved_path or self._claude_path,
            *args,
            cwd=str(session.cwd),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        session.tasks = [
            asyncio.create_task(self._read_stdout(session)),
            asyncio.create_task(self._read_stderr(session)),
            asyncio.create_task(self._wait(session)),
        ]

    async def _read_stdout(self, session: _ClaudeSession) -> None:
        assert session.process and session.process.stdout
        while line := await session.process.stdout.readline():
            text = line.decode(errors="replace").strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
                if payload.get("session_id"):
                    session.thread_id = str(payload["session_id"])
                converted, session.sequence = events_from_message(payload, session.sequence)
                if any(event["type"] in {"exited", "error"} for event in converted):
                    session.terminal_emitted = True
                session.events.extend(converted)
            except json.JSONDecodeError:
                session.sequence += 1
                session.events.append({"type": "output", "sequence": session.sequence, "content": text})

    async def _read_stderr(self, session: _ClaudeSession) -> None:
        assert session.process and session.process.stderr
        while line := await session.process.stderr.readline():
            text = line.decode(errors="replace").strip()
            if text:
                session.sequence += 1
                session.events.append({"type": "output", "sequence": session.sequence, "content": text})

    async def _wait(self, session: _ClaudeSession) -> None:
        assert session.process
        code = await session.process.wait()
        await asyncio.gather(*session.tasks[:2], return_exceptions=True)
        if not session.terminal_emitted:
            session.sequence += 1
            session.events.append({"type": "exited", "sequence": session.sequence, "code": code, "sessionId": session.thread_id or None})
            session.terminal_emitted = True

    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        for event in self.poll(session_id):
            yield ExecutionEvent(event["type"], event["sequence"], {key: value for key, value in event.items() if key not in {"type", "sequence"}})

    def poll(self, session_id: str) -> list[dict]:
        session = self._sessions.get(session_id)
        if not session:
            return [{"type": "error", "sequence": 0, "error": f"Session not found: {session_id}"}]
        events, session.events = session.events, []
        return events

    async def respond(self, session_id: str, decision: dict) -> None:
        if session_id not in self._sessions:
            raise ValueError(f"CLAUDE_SESSION_NOT_FOUND: {session_id}")
        raise ValueError("CLAUDE_APPROVAL_NOT_SUPPORTED: this adapter does not emit approval requests")

    async def send_message(self, session_id: str, prompt: str) -> None:
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"CLAUDE_SESSION_NOT_FOUND: {session_id}")
        if session.process and session.process.returncode is None:
            if not session.terminal_emitted:
                raise ValueError("CLAUDE_SESSION_STILL_RUNNING")
            try:
                await asyncio.wait_for(session.process.wait(), timeout=5)
            except asyncio.TimeoutError as exc:
                raise ValueError("CLAUDE_SESSION_STILL_RUNNING") from exc
        await self._spawn(session, prompt, resume=True)

    async def cancel(self, session_id: str) -> None:
        session = self._sessions.get(session_id)
        if not session or not session.process or session.process.returncode is not None:
            return
        session.process.terminate()
        try:
            await asyncio.wait_for(session.process.wait(), timeout=5)
        except asyncio.TimeoutError:
            session.process.kill()
            await session.process.wait()

    async def recover(self, session_id: str) -> Optional[dict]:
        session = self._sessions.get(session_id)
        if session and session.process and session.process.returncode is None:
            return {"session_id": session_id, "status": "recovered", "pid": session.process.pid}
        return None

    def session_info(self, session_id: str) -> dict:
        session = self._sessions.get(session_id)
        if not session:
            return {}
        return {"pid": session.process.pid if session.process else None, "threadId": session.thread_id or None, "turnId": None}
