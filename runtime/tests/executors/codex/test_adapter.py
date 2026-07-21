"""Tests for Codex Adapter (Task 5.2)."""

from harness_runtime.executors.codex.events import parse_codex_event


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
