"""Tests for Gate Engine (Task 3.4)."""

import tempfile
from pathlib import Path

import pytest

from harness_runtime.gates.engine import evaluate_gate
from harness_runtime.gates.permissions import check_gate_permission


class TestPermissions:
    """G3-G8 must be verifier-only."""

    def test_verifier_can_mark_g3(self):
        assert check_gate_permission("G3_COMPILE", "verifier") is None

    def test_developer_cannot_mark_g3(self):
        assert check_gate_permission("G3_COMPILE", "developer") == "GATE_PERMISSION_DENIED"

    def test_developer_can_mark_g1(self):
        assert check_gate_permission("G1_REQUIREMENTS", "developer") is None

    def test_all_verifier_gates_blocked(self):
        for gate in ["G3_COMPILE", "G4_UNIT_TEST", "G5_ATDD", "G6_EVIDENCE", "G7_PRERELEASE", "G8_ACCEPTANCE"]:
            assert check_gate_permission(gate, "developer") == "GATE_PERMISSION_DENIED"


class TestGateEngine:
    """Gate evaluation with deterministic artifact checks."""

    @pytest.fixture
    def tmp_phase(self):
        with tempfile.TemporaryDirectory() as tmp:
            yield Path(tmp)

    def test_not_required_stays(self, tmp_phase):
        state = {"gates": {"G5_ATDD": "NOT_REQUIRED"}, "retry_counts": {}}
        result = evaluate_gate("G5_ATDD", state, tmp_phase)
        assert result["status"] == "NOT_REQUIRED"

    def test_missing_artifact_fails(self, tmp_phase):
        state = {"gates": {"G1_REQUIREMENTS": "NOT_RUN"}, "retry_counts": {}}
        recovery = {"gate_to_node": {"G1_REQUIREMENTS": "REQUIREMENT_REVIEW"}}
        result = evaluate_gate("G1_REQUIREMENTS", state, tmp_phase, failure_recovery=recovery)
        assert result["status"] == "FAIL"
        assert result["retry_target"] == "REQUIREMENT_REVIEW"

    def test_existing_artifact_passes(self, tmp_phase):
        art = tmp_phase / "12-compile.md"
        art.write_text("# Compile OK")
        state = {"gates": {"G3_COMPILE": "NOT_RUN"}, "retry_counts": {}}
        # Call as verifier
        result = evaluate_gate("G3_COMPILE", state, tmp_phase, caller_role="verifier")
        assert result["status"] == "PASS"

    def test_empty_artifact_fails(self, tmp_phase):
        art = tmp_phase / "13-unit-test.md"
        art.write_text("")  # empty
        state = {"gates": {"G4_UNIT_TEST": "NOT_RUN"}, "retry_counts": {}}
        result = evaluate_gate("G4_UNIT_TEST", state, tmp_phase, caller_role="verifier")
        assert result["status"] == "FAIL"

    def test_retry_exhausted_blocks(self, tmp_phase):
        state = {
            "gates": {"G1_REQUIREMENTS": "NOT_RUN"},
            "retry_counts": {"G1_REQUIREMENTS": 2},  # already at max
            "blocked_by": [],
        }
        result = evaluate_gate("G1_REQUIREMENTS", state, tmp_phase)
        assert result["status"] == "BLOCKED"
        assert "G1_REQUIREMENTS_retry_exhausted" in state["blocked_by"]

    def test_permission_denied(self, tmp_phase):
        art = tmp_phase / "12-compile.md"
        art.write_text("ok")
        state = {"gates": {"G3_COMPILE": "NOT_RUN"}, "retry_counts": {}}
        result = evaluate_gate("G3_COMPILE", state, tmp_phase, caller_role="developer")
        assert result["status"] == "FAIL"
        assert result["reason"] == "GATE_PERMISSION_DENIED"
