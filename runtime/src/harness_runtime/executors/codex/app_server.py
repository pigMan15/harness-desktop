"""Async JSONL client for ``codex app-server --stdio``."""

import asyncio
import json
import os
import subprocess
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional


ProcessFactory = Callable[..., Awaitable[asyncio.subprocess.Process]]


class CodexAppServer:
    """Own one Codex app-server process and one Harness execution turn."""

    def __init__(
        self,
        codex_path: str,
        project_root: Path,
        process_factory: Optional[ProcessFactory] = None,
    ):
        self.codex_path = codex_path
        self.project_root = project_root.resolve()
        self._process_factory = process_factory or asyncio.create_subprocess_exec
        self._process: asyncio.subprocess.Process | None = None
        self._reader_task: asyncio.Task | None = None
        self._stderr_task: asyncio.Task | None = None
        self._pending: dict[int, asyncio.Future] = {}
        self._approval_methods: dict[int, str] = {}
        self._events: list[dict[str, Any]] = []
        self._next_request_id = 1
        self._sequence = 0
        self._closed = False
        self._terminal_event_sent = False
        self.thread_id = ""
        self.turn_id = ""

    @property
    def pid(self) -> int:
        return self._process.pid if self._process else 0

    async def start(self, prompt: str, developer_instructions: str = "") -> None:
        """Start app-server, negotiate the protocol, and submit one turn."""
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        self._process = await self._process_factory(
            self.codex_path,
            "app-server",
            "--stdio",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            creationflags=creationflags,
        )
        if not self._process.stdin or not self._process.stdout:
            raise RuntimeError("CODEX_APP_SERVER_STDIO_UNAVAILABLE")

        self._reader_task = asyncio.create_task(self._read_stdout())
        if self._process.stderr:
            self._stderr_task = asyncio.create_task(self._read_stderr())

        await self._request(
            "initialize",
            {
                "clientInfo": {
                    "name": "harness-desktop",
                    "title": "Harness Desktop",
                    "version": "0.0.0",
                },
                "capabilities": {"experimentalApi": False},
            },
        )
        await self._notification("initialized")

        thread_params: dict[str, Any] = {
            "cwd": str(self.project_root),
            "approvalPolicy": "on-request",
            "approvalsReviewer": "user",
            "ephemeral": True,
        }
        if developer_instructions:
            thread_params["developerInstructions"] = developer_instructions
        thread_result = await self._request("thread/start", thread_params)
        self.thread_id = thread_result.get("thread", {}).get("id", "")
        if not self.thread_id:
            raise RuntimeError("CODEX_THREAD_START_MISSING_ID")

        turn_result = await self._request(
            "turn/start",
            {
                "threadId": self.thread_id,
                "input": [{"type": "text", "text": prompt}],
            },
        )
        self.turn_id = turn_result.get("turn", {}).get("id", "")
        if not self.turn_id:
            raise RuntimeError("CODEX_TURN_START_MISSING_ID")

    def poll_events(self) -> list[dict[str, Any]]:
        """Drain currently available events without blocking an HTTP poll."""
        events, self._events = self._events, []
        return events

    async def respond(self, request_id: int, decision: str) -> None:
        """Respond to an app-server initiated approval request."""
        if request_id not in self._approval_methods:
            raise ValueError(f"CODEX_APPROVAL_NOT_FOUND: {request_id}")
        mapped = {
            "allow_once": "accept",
            "allow_session": "acceptForSession",
            "deny": "decline",
            "cancel": "cancel",
        }.get(decision)
        if not mapped:
            raise ValueError(f"CODEX_APPROVAL_DECISION_INVALID: {decision}")
        await self._response(request_id, {"decision": mapped})
        del self._approval_methods[request_id]

    async def interrupt(self) -> None:
        """Interrupt the active turn while keeping protocol shutdown orderly."""
        if self.thread_id and self.turn_id and not self._closed:
            await self._request(
                "turn/interrupt",
                {"threadId": self.thread_id, "turnId": self.turn_id},
            )

    async def close(self) -> None:
        self._closed = True
        process = self._process
        if process and process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        tasks = [task for task in (self._reader_task, self._stderr_task) if task]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        request_id = self._next_request_id
        self._next_request_id += 1
        future = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        await self._write({"id": request_id, "method": method, "params": params})
        try:
            return await asyncio.wait_for(future, timeout=30)
        finally:
            self._pending.pop(request_id, None)

    async def _notification(self, method: str, params: Optional[dict] = None) -> None:
        message: dict[str, Any] = {"method": method}
        if params is not None:
            message["params"] = params
        await self._write(message)

    async def _response(self, request_id: int, result: dict[str, Any]) -> None:
        await self._write({"id": request_id, "result": result})

    async def _write(self, message: dict[str, Any]) -> None:
        if not self._process or not self._process.stdin or self._closed:
            raise RuntimeError("CODEX_APP_SERVER_NOT_RUNNING")
        payload = json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n"
        self._process.stdin.write(payload.encode("utf-8"))
        await self._process.stdin.drain()

    async def _read_stdout(self) -> None:
        assert self._process and self._process.stdout
        try:
            async for raw_line in self._process.stdout:
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    message = json.loads(line)
                except json.JSONDecodeError:
                    self._emit("output", content=line, format="text")
                    continue
                self._handle_message(message)
        except Exception as exc:
            self._emit("error", error=f"Codex protocol reader failed: {exc}")
        finally:
            error = RuntimeError("CODEX_APP_SERVER_EXITED")
            for future in self._pending.values():
                if not future.done():
                    future.set_exception(error)
            if not self._closed and not self._terminal_event_sent:
                self._emit("error", error="Codex app-server exited unexpectedly")

    async def _read_stderr(self) -> None:
        assert self._process and self._process.stderr
        async for raw_line in self._process.stderr:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if line:
                self._emit("output", content=line, format="stderr")

    def _handle_message(self, message: dict[str, Any]) -> None:
        request_id = message.get("id")
        method = message.get("method")
        if request_id is not None and not method:
            future = self._pending.get(request_id)
            if not future or future.done():
                return
            if "error" in message:
                future.set_exception(RuntimeError(f"CODEX_RPC_ERROR: {message['error']}"))
            else:
                future.set_result(message.get("result") or {})
            return
        if request_id is not None and method:
            self._handle_server_request(int(request_id), method, message.get("params") or {})
            return
        if method:
            self._handle_notification(method, message.get("params") or {})

    def _handle_server_request(self, request_id: int, method: str, params: dict) -> None:
        categories = {
            "item/commandExecution/requestApproval": "command",
            "item/fileChange/requestApproval": "file",
            "item/permissions/requestApproval": "permission",
        }
        category = categories.get(method, "external")
        # Server request 必须保留原始 id，用户响应后才能准确回写对应审批。
        self._approval_methods[request_id] = method
        self._emit(
            "approval_required",
            requestId=request_id,
            category=category,
            message=params.get("reason") or f"Codex requests {category} approval",
            params=params,
        )

    def _handle_notification(self, method: str, params: dict) -> None:
        if method in {
            "item/agentMessage/delta",
            "item/commandExecution/outputDelta",
            "item/fileChange/outputDelta",
        }:
            self._emit("output", content=params.get("delta", ""), format="text")
            return
        if method == "item/started":
            item = params.get("item") or {}
            self._emit(
                "tool_call",
                tool=item.get("type", "item"),
                params=item,
                itemId=item.get("id", ""),
            )
            return
        if method == "turn/completed":
            turn = params.get("turn") or {}
            status = turn.get("status", "completed")
            self._terminal_event_sent = True
            if status == "failed":
                self._emit("error", error=turn.get("error") or "Codex turn failed")
            else:
                self._emit("exited", code=130 if status == "interrupted" else 0, status=status)
            return
        if method == "error" and not params.get("willRetry", False):
            self._emit("error", error=params.get("error") or "Codex turn error")

    def _emit(self, event_type: str, **data: Any) -> None:
        self._sequence += 1
        self._events.append({"type": event_type, "sequence": self._sequence, **data})
