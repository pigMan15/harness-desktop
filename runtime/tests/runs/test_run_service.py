"""Tests for Run Service (Task 3.2)."""

import json
import shutil
from pathlib import Path

import pytest

from harness_runtime.runs.service import (
    create_run,
    create_run_and_activate,
    list_runs,
    pause_active_run,
    pause_run,
    resume_active_run,
    resume_run,
    switch_run,
)
from harness_runtime.runs.identifiers import validate_run_id
from harness_runtime.persistence.state_store import read_run_state, read_state, write_run_state

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


@pytest.fixture
def writable_project(tmp_path):
    project_root = tmp_path / "project"
    shutil.copytree(FIXTURES / "valid-project", project_root)
    return project_root


class TestPersistedRunLifecycle:
    def test_create_persists_active_state_snapshot_and_phase_dir(self, writable_project):
        state, revision = create_run_and_activate(
            writable_project, "FEATURE", "LOW", "new-task"
        )

        active = json.loads(
            (writable_project / ".harness" / "state.json").read_text(encoding="utf-8")
        )
        snapshot = json.loads(
            (writable_project / ".harness" / "runs" / "new-task" / "state.json").read_text(
                encoding="utf-8"
            )
        )
        assert state["run_id"] == "new-task"
        assert active["run_id"] == "new-task"
        assert snapshot["run_id"] == "new-task"
        assert (writable_project / ".harness" / "phases" / "new-task").is_dir()
        assert revision

    def test_duplicate_run_is_rejected_before_state_write(self, writable_project):
        create_run_and_activate(writable_project, "FEATURE", "LOW", "duplicate-task")

        with pytest.raises(ValueError, match="already exists"):
            create_run_and_activate(writable_project, "FEATURE", "LOW", "duplicate-task")

    def test_switch_pause_and_resume_keep_snapshot_in_sync(self, writable_project):
        first, _ = create_run_and_activate(writable_project, "FEATURE", "LOW", "first-task")
        create_run_and_activate(writable_project, "BUG_FIX", "MEDIUM", "second-task")

        switched, _ = switch_run(writable_project, first["run_id"])
        paused, _ = pause_active_run(writable_project, first["run_id"])
        resumed, _ = resume_active_run(writable_project, first["run_id"])

        snapshot = json.loads(
            (writable_project / ".harness" / "runs" / "first-task" / "state.json").read_text(
                encoding="utf-8"
            )
        )
        assert switched["run_id"] == "first-task"
        assert paused["status"] == "BLOCKED"
        assert resumed["status"] == "IN_PROGRESS"
        assert snapshot["status"] == "IN_PROGRESS"
        assert "user_paused" not in snapshot["blocked_by"]

    def test_list_runs_returns_full_summary_and_active_marker(self, writable_project):
        create_run_and_activate(writable_project, "FEATURE", "LOW", "listed-task")

        runs = list_runs(writable_project)
        listed = next(run for run in runs if run["run_id"] == "listed-task")

        assert listed["intent"] == "FEATURE"
        assert listed["risk"] == "LOW"
        assert listed["active"] is True
        assert listed["required_nodes"]

    def test_two_runs_have_independent_revisions_and_lifecycle(self, writable_project):
        first, first_revision = create_run_and_activate(
            writable_project, "FEATURE", "LOW", "parallel-first"
        )
        second, second_revision = create_run_and_activate(
            writable_project, "BUG_FIX", "MEDIUM", "parallel-second"
        )

        first["notes"] = "first changed"
        new_first_revision = write_run_state(
            writable_project, "parallel-first", first, expected_revision=first_revision
        )
        with pytest.raises(RuntimeError, match="REVISION_CONFLICT"):
            write_run_state(
                writable_project, "parallel-first", first, expected_revision=first_revision
            )

        paused_second, new_second_revision = pause_active_run(
            writable_project, "parallel-second", expected_revision=second_revision
        )
        persisted_first, persisted_first_revision = read_run_state(
            writable_project, "parallel-first"
        )

        assert persisted_first["notes"] == "first changed"
        assert persisted_first_revision == new_first_revision
        assert paused_second["status"] == "BLOCKED"
        assert new_second_revision != second_revision

    def test_root_projection_cannot_overwrite_authoritative_run(self, writable_project):
        state, revision = create_run_and_activate(
            writable_project, "FEATURE", "LOW", "projection-guard"
        )
        state["notes"] = "authoritative"
        write_run_state(
            writable_project, "projection-guard", state, expected_revision=revision
        )

        projection_path = writable_project / ".harness" / "state.json"
        projection = json.loads(projection_path.read_text(encoding="utf-8"))
        projection["notes"] = "stale projection"
        projection_path.write_text(
            json.dumps(projection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        authoritative, _ = read_run_state(writable_project, "projection-guard")
        selected, _ = read_state(writable_project)
        assert authoritative["notes"] == "authoritative"
        assert selected["notes"] == "authoritative"
