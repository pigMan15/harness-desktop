"""Codex event parser — parses stdout JSON events from Codex subprocess.

Architecture §5.2: recognize ExecutionOutput / ToolCall / ApprovalRequested / Exited.
"""

import json
from ..base import ExecutionEvent


def parse_codex_event(raw: str) -> ExecutionEvent:
    """Parse a raw line of JSON from Codex stdout into an ExecutionEvent."""
    try:
        data = json.loads(raw.strip())
    except json.JSONDecodeError:
        return ExecutionEvent("output", 0, {"content": raw, "format": "text"})

    event_type = data.get("type", "output")
    sequence = data.get("sequence", 0)

    if event_type == "tool_use":
        return ExecutionEvent("tool_call", sequence, {
            "tool": data.get("tool", "unknown"),
            "params": data.get("params", {}),
        })
    elif event_type == "approval_request":
        return ExecutionEvent("approval_required", sequence, {
            "message": data.get("message", ""),
            "category": data.get("category", "command"),
        })
    elif event_type == "exit":
        return ExecutionEvent("exited", sequence, {"code": data.get("code", 0)})
    elif event_type == "error":
        return ExecutionEvent("error", sequence, {"error": data.get("error", "unknown error")})
    else:
        return ExecutionEvent("output", sequence, {"content": data.get("content", raw), "format": "json"})
