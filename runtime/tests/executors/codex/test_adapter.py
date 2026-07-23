"""Tests for the Codex app-server adapter."""

import asyncio
import json

from harness_runtime.executors.codex.app_server import CodexAppServer
from harness_runtime.executors.codex.events import parse_codex_event


class _FakeStdin:
    def __init__(self, stdout):
        self.stdout = stdout
        self.messages = []

    def write(self, data):
        message = json.loads(data.decode("utf-8"))
        self.messages.append(message)
        method = message.get("method")
        if "id" not in message or not method:
            return
        results = {
            "initialize": {"userAgent": "mock-codex"},
            "thread/start": {"thread": {"id": "thread-1"}},
            "turn/start": {
                "turn": {"id": "turn-1", "items": [], "status": "inProgress"}
            },
            "turn/interrupt": {},
        }
        self.stdout.feed_data(
            (json.dumps({"id": message["id"], "result": results[method]}) + "\n").encode()
        )
        if method == "turn/start":
            notifications = [
                {
                    "method": "item/agentMessage/delta",
                    "params": {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "itemId": "item-1",
                        "delta": "working",
                    },
                },
                {
                    "id": 91,
                    "method": "item/commandExecution/requestApproval",
                    "params": {
                        "threadId": "thread-1",
                        "turnId": "turn-1",
                        "itemId": "item-2",
                        "startedAtMs": 1,
                        "reason": "run tests",
                    },
                },
            ]
            for notification in notifications:
                self.stdout.feed_data((json.dumps(notification) + "\n").encode())

    async def drain(self):
        await asyncio.sleep(0)


class _FakeProcess:
    def __init__(self):
        self.stdout = asyncio.StreamReader()
        self.stderr = asyncio.StreamReader()
        self.stdin = _FakeStdin(self.stdout)
        self.pid = 4242
        self.returncode = None

    async def wait(self):
        return 0

    def terminate(self):
        self.returncode = 0
        self.stdout.feed_eof()
        self.stderr.feed_eof()

    def kill(self):
        self.terminate()


def test_app_server_protocol_approval_and_interrupt(tmp_path):
    async def scenario():
        process = _FakeProcess()

        async def process_factory(*_args, **_kwargs):
            return process

        server = CodexAppServer("mock-codex", tmp_path, process_factory=process_factory)
        await server.start("Execute the active Harness node")
        await asyncio.sleep(0)

        methods = [message.get("method") for message in process.stdin.messages]
        assert methods[:4] == ["initialize", "initialized", "thread/start", "turn/start"]
        turn_start = next(
            message for message in process.stdin.messages if message.get("method") == "turn/start"
        )
        assert turn_start["params"]["threadId"] == "thread-1"
        assert turn_start["params"]["input"][0]["text"] == "Execute the active Harness node"

        events = server.poll_events()
        assert [event["type"] for event in events] == ["output", "approval_required"]
        assert events[1]["requestId"] == 91
        assert events[1]["category"] == "command"

        await server.respond(91, "allow_once")
        assert process.stdin.messages[-1] == {"id": 91, "result": {"decision": "accept"}}

        await server.interrupt()
        assert process.stdin.messages[-1]["method"] == "turn/interrupt"
        assert process.stdin.messages[-1]["params"] == {
            "threadId": "thread-1",
            "turnId": "turn-1",
        }
        await server.close()

    asyncio.run(scenario())


class TestEventParsing:
    def test_output_event(self):
        event = parse_codex_event('{"type":"output","content":"hello"}')
        assert event.type == "output"

    def test_tool_call_event(self):
        event = parse_codex_event('{"type":"tool_use","tool":"write_file","params":{"path":"x.py"}}')
        assert event.type == "tool_call"
        assert event.data["tool"] == "write_file"

    def test_approval_event(self):
        event = parse_codex_event('{"type":"approval_request","message":"Allow?","category":"command"}')
        assert event.type == "approval_required"

    def test_exit_event(self):
        event = parse_codex_event('{"type":"exit","code":0}')
        assert event.type == "exited"

    def test_error_event(self):
        event = parse_codex_event('{"type":"error","error":"crash"}')
        assert event.type == "error"

    def test_plain_text_fallback(self):
        event = parse_codex_event("just plain text, not JSON")
        assert event.type == "output"
        assert event.data["format"] == "text"
