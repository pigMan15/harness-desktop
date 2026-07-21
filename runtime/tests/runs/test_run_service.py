"""Tests for Run Service (Task 3.2)."""

from pathlib import Path

import pytest

from harness_runtime.runs.service import create_run, list_runs, pause_run, resume_run
from harness_runtime.runs.identifiers import validate_run_id

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"


class TestRunIdValidation:
    """Run ID validation — must fail before mkdir."""

    def test_valid_run_id(self):
        assert validate_run_id("feature-export-20260721") == []

    def test_invalid_path_traversal(self):
        errors = validate_run_id("../escape")
        assert len(errors) > 0

    def test_invalid_drive_letter(self):
        errors = validate_run_id("C:something")
        assert len(errors) > 0

    def test_invalid_regex(self):
        errors = validate_run_id("")
        assert len(errors) > 0

    def test_duplicate(self):
        errors = validate_run_id("test-001", {"test-001"})
        assert len(errors) > 0


class TestCreateRun:
    """Run creation with workflow compilation."""

    @pytest.fixture
    def project_root(self):
        return FIXTURES / "valid-project"

    def test_create_feature_high(self, project_root):
        state = create_run(project_root, "FEATURE", "HIGH", "test-feature-high")
        assert state["intent"] == "FEATURE"
        assert state["risk"] == "HIGH"
        assert len(state["required_nodes"]) >= 20
        assert "COMPILE" in state["required_nodes"]
        assert state["completed_nodes"] == []
        assert state["gates"]["G1_REQUIREMENTS"] == "NOT_RUN"

    def test_create_query(self, project_root):
        state = create_run(project_root, "QUERY", "NA", "test-query")
        assert "COMPILE" not in state["required_nodes"]

    def test_create_invalid_intent(self, project_root):
        with pytest.raises(ValueError, match="Invalid intent"):
            create_run(project_root, "HACK", "LOW", "test-bad")

    def test_create_invalid_risk(self, project_root):
        with pytest.raises(ValueError, match="Invalid risk"):
            create_run(project_root, "FEATURE", "EXTREME", "test-bad")

    def test_create_bad_run_id(self, project_root):
        with pytest.raises(ValueError, match="Invalid run_id"):
            create_run(project_root, "FEATURE", "LOW", "../escape")


class TestPauseResume:
    """Pause and resume run lifecycle."""

    def test_pause(self):
        state = {"status": "IN_PROGRESS", "blocked_by": [], "required_nodes": [], "completed_nodes": []}
        state = pause_run(state)
        assert state["status"] == "BLOCKED"
        assert "user_paused" in state["blocked_by"]

    def test_resume(self):
        state = {"status": "BLOCKED", "blocked_by": ["user_paused"], "required_nodes": [], "completed_nodes": []}
        state = resume_run(state)
        assert state["status"] == "IN_PROGRESS"
        assert "user_paused" not in state["blocked_by"]
