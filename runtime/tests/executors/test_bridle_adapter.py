"""Verify the bridle executor adapter works with the real bridle binary."""
import pytest
from harness_runtime.executors.bridle_adapter import BridleAdapter


class TestBridleProbe:
    @pytest.mark.anyio
    async def test_probe_finds_bridle(self):
        adapter = BridleAdapter()
        cap = await adapter.probe()
        assert cap.available, f"bridle not found: {cap.diagnostics}"
        assert "bridle" in cap.path
        assert cap.version

    @pytest.mark.anyio
    async def test_probe_features(self):
        adapter = BridleAdapter()
        cap = await adapter.probe()
        assert "doctor" in cap.features
        assert "status" in cap.features
        assert "validate" in cap.features

    @pytest.mark.anyio
    async def test_start_and_stream(self):
        from harness_runtime.executors.base import ExecutionRequest
        adapter = BridleAdapter()
        req = ExecutionRequest(project_root=".", run_id="test", node_id="DEVELOPMENT", role_file="developer.md", rules=[], phase_dir=".")
        sid = await adapter.start(req)
        assert sid.startswith("bridle-")
        events = [e async for e in adapter.stream(sid)]
        assert any(e.type == "tool_call" for e in events)
        assert any(e.type == "exited" for e in events)
        assert len(events) > 0
