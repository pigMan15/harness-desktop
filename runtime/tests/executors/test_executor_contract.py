"""Tests for Executor Contract + Fake Executor (Task 5.1)."""

import pytest

from harness_runtime.executors.base import ExecutionRequest
from harness_runtime.executors.fake import FakeExecutor

pytestmark = pytest.mark.anyio


@pytest.fixture
def fake():
    return FakeExecutor()


@pytest.fixture
def request_data():
    return ExecutionRequest(
        project_root="/tmp/test", run_id="r1", node_id="DEVELOPMENT",
        role_file="developer.md", rules=["code_changed_requires"], phase_dir="/tmp/test/phases/r1",
    )


class TestProbe:
    @pytest.mark.anyio
    async def test_probe_available(self, fake):
        cap = await fake.probe()
        assert cap.available
        assert cap.version == "0.0.0-test"

    async def test_probe_features(self, fake):
        cap = await fake.probe()
        assert "approval" in cap.features
        assert "cancel" in cap.features


class TestStartAndStream:
    async def test_start_returns_session(self, fake, request_data):
        sid = await fake.start(request_data)
        assert sid.startswith("fake-")

    async def test_stream_output(self, fake, request_data):
        fake.script_output("# Hello")
        sid = await fake.start(request_data)
        events = [e async for e in fake.stream(sid)]
        assert any(e.type == "output" for e in events)
        assert any(e.type == "exited" for e in events)

    async def test_stream_approval(self, fake, request_data):
        fake.script_approval("Allow rm -rf /?", "delete")
        sid = await fake.start(request_data)
        events = [e async for e in fake.stream(sid)]
        approvals = [e for e in events if e.type == "approval_required"]
        assert len(approvals) == 1
        assert approvals[0].data["category"] == "delete"

    async def test_stream_tool_call(self, fake, request_data):
        fake.script_tool_call("write_file", {"path": "test.py", "content": "x=1"})
        sid = await fake.start(request_data)
        events = [e async for e in fake.stream(sid)]
        tools = [e for e in events if e.type == "tool_call"]
        assert len(tools) == 1


class TestCancel:
    async def test_cancel(self, fake, request_data):
        fake.script_output("start")
        fake.script_timeout(0.1)
        fake.script_output("after")
        sid = await fake.start(request_data)
        await fake.cancel(sid)
        events = [e async for e in fake.stream(sid)]
        assert any(e.type == "error" and "cancelled" in str(e.data) for e in events)


class TestRespond:
    async def test_respond(self, fake, request_data):
        fake.script_approval("test", "command")
        sid = await fake.start(request_data)
        await fake.respond(sid, {"decision": "allow_once"})
        # Stream consumes the script; respond records the decision
        _events = [e async for e in fake.stream(sid)]


class TestRecover:
    async def test_recover(self, fake, request_data):
        sid = await fake.start(request_data)
        result = await fake.recover(sid)
        assert result is not None
        assert result["status"] == "recovered"

    async def test_recover_unknown_session(self, fake):
        result = await fake.recover("nonexistent")
        assert result is None
