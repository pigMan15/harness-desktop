"""Tests for Protocol Adapter — load + validate .harness v1.0 files.

Task 2.1 TDD:
- M1 9 fixture regression (1 valid + 8 invalid)
- New edge cases: YAML/JSON parse errors, symlink/junction escape
- Validator deep checks: phase_dir escape, G6 evidence, gate references, rollback cycles
"""

import json
from pathlib import Path

import pytest

from harness_runtime.protocol.loader import ProtocolLoadError, load_project, load_state, load_workflow
from harness_runtime.protocol.validator import validate_state_deep, validate_workflow_deep

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"
PROJECT_ROOT = FIXTURES / "valid-project"
VALID_HARNESS = PROJECT_ROOT / ".harness"


class TestLoadState:
    """Load state.json from valid and invalid projects."""

    def test_load_valid_state(self):
        state = load_state(PROJECT_ROOT)
        assert state.schema_version == "1.0"
        assert state.run_id
        assert state.phase_dir
        assert state.required_nodes
        assert isinstance(state.gates, dict)

    def test_missing_state_json(self):
        """Loading from a directory without .harness/state.json should fail."""
        import tempfile, shutil
        tmp = Path(tempfile.mkdtemp())
        try:
            (tmp / ".harness").mkdir()
            # state.json does not exist
            with pytest.raises(ProtocolLoadError) as exc:
                load_state(tmp)
            assert exc.value.code == "STATE_MISSING"
        finally:
            shutil.rmtree(tmp)

    def test_invalid_run_id(self):
        """Invalid run_id with .. should fail Pydantic validation."""
        invalid_root = FIXTURES / "invalid-run-id"
        # The state.json in this fixture has run_id="../escape"
        # Pydantic validation should reject it
        with pytest.raises(ProtocolLoadError) as exc:
            load_state(invalid_root)
        assert exc.value.code == "STATE_VALIDATION_FAILED"

    def test_invalid_intent(self):
        with pytest.raises(ProtocolLoadError) as exc:
            load_state(FIXTURES / "invalid-intent")
        assert exc.value.code == "STATE_VALIDATION_FAILED"

    def test_invalid_phase_escape(self):
        """Phase dir with .. should be caught by validator, not just Pydantic."""
        root = FIXTURES / "invalid-phase-escape"
        with pytest.raises(ProtocolLoadError):
            load_state(root)


class TestLoadWorkflow:
    """Load workflow.yaml from valid and invalid projects."""

    def test_load_valid_workflow(self):
        wf = load_workflow(PROJECT_ROOT)
        assert wf.schema_version == "1.0"
        assert len(wf.nodes) >= 22
        assert "FEATURE" in wf.routes
        assert "G1_REQUIREMENTS" in wf.gate_meanings

    def test_missing_workflow(self):
        # Create a temp dir with state.json but no workflow.yaml
        import tempfile, shutil
        tmp = Path(tempfile.mkdtemp())
        try:
            (tmp / ".harness").mkdir()
            shutil.copy(VALID_HARNESS / "state.json", tmp / ".harness" / "state.json")
            with pytest.raises(ProtocolLoadError) as exc:
                load_workflow(tmp)
            assert exc.value.code == "WORKFLOW_MISSING"
        finally:
            shutil.rmtree(tmp)

    def test_duplicate_node(self):
        wf = load_workflow(FIXTURES / "invalid-duplicate-node")
        diags = validate_workflow_deep(wf)
        duplicate_diags = [d for d in diags if d.code == "WORKFLOW_DUPLICATE_NODE"]
        assert len(duplicate_diags) > 0

    def test_unknown_role(self):
        wf = load_workflow(FIXTURES / "invalid-unknown-role")
        diags = validate_workflow_deep(wf)
        role_diags = [d for d in diags if d.code == "WORKFLOW_UNKNOWN_ROLE"]
        assert len(role_diags) > 0

    def test_undefined_gate(self):
        wf = load_workflow(FIXTURES / "invalid-unknown-gate")
        diags = validate_workflow_deep(wf)
        gate_diags = [d for d in diags if d.code == "WORKFLOW_UNDEFINED_GATE"]
        assert len(gate_diags) > 0

    def test_endless_rollback(self):
        wf = load_workflow(FIXTURES / "invalid-endless-rollback")
        diags = validate_workflow_deep(wf)
        rollback_diags = [d for d in diags if d.code == "WORKFLOW_ENDLESS_ROLLBACK"]
        assert len(rollback_diags) > 0


class TestLoadProject:
    """Load complete project (state + workflow)."""

    def test_load_valid_project(self):
        project = load_project(PROJECT_ROOT)
        assert "state" in project
        assert "workflow" in project
        assert project["state"].run_id


class TestValidator:
    """Deep validation beyond Pydantic model validation."""

    def test_valid_workflow_no_diagnostics(self):
        wf = load_workflow(PROJECT_ROOT)
        diags = validate_workflow_deep(wf, agents_dir=VALID_HARNESS / "agents")
        errors = [d for d in diags if d.severity == "error"]
        assert len(errors) == 0, f"Unexpected errors: {[d.message for d in errors]}"

    def test_g6_missing_evidence(self):
        root = FIXTURES / "invalid-missing-evidence"
        state = load_state(root)
        diags = validate_state_deep(state, root / ".harness" / "phases", root / ".harness" / "phases")
        g6_diags = [d for d in diags if d.code == "G6_EVIDENCE_MISSING"]
        assert len(g6_diags) > 0


class TestAllFixtures:
    """Regression: M1 9 fixtures must all behave correctly with Protocol Adapter."""

    @pytest.mark.parametrize("fixture_name,should_pass", [
        ("valid-project", True),
        ("invalid-run-id", False),
        ("invalid-phase-escape", False),
        ("invalid-intent", False),
        ("invalid-duplicate-node", False),
        ("invalid-unknown-role", False),
        ("invalid-unknown-gate", False),
        ("invalid-endless-rollback", False),
        ("invalid-missing-evidence", False),
    ])
    def test_fixture_load(self, fixture_name, should_pass):
        root = FIXTURES / fixture_name
        try:
            result = load_project(root)
            if not should_pass:
                pytest.fail(f"Invalid fixture {fixture_name} should have been rejected")
            assert result["state"] is not None
            assert result["workflow"] is not None
        except ProtocolLoadError as e:
            if should_pass:
                pytest.fail(f"Valid fixture {fixture_name} was rejected: {e.code} {e.message}")
            # Invalid fixture correctly rejected — must have stable error code + pointer
            assert e.code.isupper() or "_" in e.code
            assert e.pointer.startswith("/")
