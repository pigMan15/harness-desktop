"""Tests for Recovery Service (Task 6.2)."""

import tempfile
from pathlib import Path

from harness_runtime.recovery.service import cleanup_temp_files, verify_state_consistency


class TestVerifyState:
    def test_missing_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".harness").mkdir()
            result = verify_state_consistency(root)
            assert not result["consistent"]

    def test_valid_state(self):
        """M1 valid fixture should be consistent."""
        root = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1" / "valid-project"
        result = verify_state_consistency(root)
        # State exists and is valid JSON
        assert "state.json corrupt" not in result["issues"]

    def test_leftover_temp_files_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".harness").mkdir()
            import json
            state = {"run_id": "test-001", "schema_version": "1.0"}
            json.dump(state, open(root / ".harness" / "state.json", "w"))
            (root / ".harness" / ".tmp-test-xxx").write_text("stale")
            result = verify_state_consistency(root)
            assert any("Leftover temp" in i for i in result["issues"])


class TestCleanup:
    def test_cleanup_temp_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".harness").mkdir()
            (root / ".harness" / ".tmp-stale-1").write_text("x")
            (root / ".harness" / ".tmp-stale-2").write_text("y")
            cleaned = cleanup_temp_files(root)
            assert len(cleaned) >= 2

    def test_cleanup_stale_lock(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".harness").mkdir()
            # Write fake stale lock with non-existent PID
            (root / ".harness" / ".lock").write_text("999999")
            cleaned = cleanup_temp_files(root)
            assert ".lock" in "".join(cleaned)
