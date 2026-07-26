from harness_runtime.executors.claude.adapter import events_from_message


def test_converts_claude_assistant_content_to_shared_events():
    events, sequence = events_from_message(
        {
            "type": "assistant",
            "message": {"content": [
                {"type": "text", "text": "working"},
                {"type": "tool_use", "name": "Edit", "input": {"file_path": "README.md"}},
            ]},
        },
        0,
    )
    assert sequence == 2
    assert events[0] == {"type": "output", "sequence": 1, "content": "working"}
    assert events[1]["type"] == "tool_call"
    assert events[1]["tool"] == "Edit"


def test_converts_result_to_output_and_exit():
    events, sequence = events_from_message({"type": "result", "result": "done", "is_error": False, "session_id": "session-1"}, 4)
    assert sequence == 6
    assert events[-1] == {"type": "exited", "sequence": 6, "code": 0, "sessionId": "session-1"}
