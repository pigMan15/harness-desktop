"""Tests for Project Registry service (Task 2.2)."""

import json
import shutil
import tempfile
from pathlib import Path

import pytest

from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.projects.service import (
    get_project,
    import_project,
    list_projects,
    resolve_project_root,
    unregister_project,
    update_active_run,
    validate_project,
)
from harness_runtime.protocol.loader import ProtocolLoadError

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    """Use an in-memory database for tests."""
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(
        "harness_runtime.projects.service.get_db",
        lambda: get_db(db_path),
    )
    monkeypatch.setattr(
        "harness_runtime.persistence.database.DEFAULT_DB_PATH",
        db_path,
    )
    init_db(db_path)
    return db_path


class TestImportProject:
    """Import valid and invalid projects."""

    def test_import_valid_project(self):
        root = FIXTURES / "valid-project"
        result = import_project(str(root))
        assert result["health"] == "healthy"
        assert result["name"] == "valid-project"
        assert result["protocolVersion"] == "1.0"
        assert "projectId" in result

    def test_import_duplicate_is_idempotent(self):
        root = FIXTURES / "valid-project"
        r1 = import_project(str(root))
        r2 = import_project(str(root))
        assert r1["projectId"] == r2["projectId"]

    def test_import_non_existent_path(self):
        with pytest.raises(ValueError, match="does not exist"):
            import_project("Z:/nonexistent/path")

    def test_import_no_harness_dir_returns_initialization_preview_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = import_project(tmp)

            assert result["confirmationRequired"] is True
            assert result["action"] == "initialize"
            assert result["missingCount"] > 0
            assert not (root / ".harness").exists()

    def test_initialize_creates_fresh_local_initial_harness(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            preview = import_project(tmp)

            result = import_project(tmp, preview["action"])

            assert result["health"] == "healthy"
            state = json.loads((root / ".harness" / "state.json").read_text())
            assert state["run_id"] == "local-initial"
            assert (root / ".harness" / "runs" / "local-initial" / "state.json").is_file()
            assert not (root / ".harness" / "runs" / "desktop-foundation-20260721").exists()

    def test_partial_harness_can_append_missing_files_without_overwriting_existing_files(self):
        source = FIXTURES / "valid-project"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(source, root, dirs_exist_ok=True)
            existing = root / ".harness" / "rules" / "safety.md"
            existing.write_text("user-owned safety rules\n", encoding="utf-8")
            missing = root / ".harness" / "rules" / "code-search.md"
            missing.unlink()

            preview = import_project(tmp)
            result = import_project(tmp, "append")

            assert preview["confirmationRequired"] is True
            assert "rules/code-search.md" in preview["missingFiles"]
            assert result["health"] == "healthy"
            assert existing.read_text(encoding="utf-8") == "user-owned safety rules\n"
            assert missing.is_file()

    def test_partial_harness_skip_registers_without_writing(self):
        source = FIXTURES / "valid-project"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(source, root, dirs_exist_ok=True)
            workflow = root / ".harness" / "workflow.yaml"
            original = workflow.read_bytes()
            workflow.unlink()

            preview = import_project(tmp)
            result = import_project(tmp, "skip")

            assert preview["action"] == "append"
            assert result["health"] == "degraded"
            assert not workflow.exists()
            assert original != b""

    def test_initialize_validation_failure_rolls_back_and_does_not_register(
        self, tmp_path, monkeypatch
    ):
        monkeypatch.setattr(
            "harness_runtime.projects.service.load_project",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(
                ProtocolLoadError("TEST_FAILURE", "simulated validation failure")
            ),
        )

        with pytest.raises(ProtocolLoadError, match="TEST_FAILURE"):
            import_project(str(tmp_path), "initialize")

        assert not (tmp_path / ".harness").exists()
        assert list_projects() == []


class TestListAndUnregister:
    """List and unregister projects."""

    def test_list_empty(self):
        projects = list_projects()
        assert isinstance(projects, list)
        # May be empty or contain previously imported test projects

    def test_list_after_import(self):
        root = FIXTURES / "valid-project"
        import_project(str(root))
        projects = list_projects()
        names = [p["name"] for p in projects]
        assert "valid-project" in names

    def test_unregister(self):
        root = FIXTURES / "valid-project"
        result = import_project(str(root))
        pid = result["projectId"]
        assert unregister_project(pid) is True
        assert unregister_project("nonexistent-id") is False

    def test_resolve_registered_project_root(self):
        root = FIXTURES / "valid-project"
        project = import_project(str(root))

        assert resolve_project_root(project["projectId"]) == root.resolve()
        assert get_project(project["projectId"])["path"] == str(root.resolve())

    def test_unknown_project_id_is_rejected(self):
        with pytest.raises(ValueError, match="PROJECT_NOT_FOUND"):
            resolve_project_root("missing-project")

    def test_missing_registered_directory_is_rejected(self, tmp_path, setup_db):
        project_root = tmp_path / "removable-project"
        project_root.mkdir()
        (project_root / ".harness").mkdir()
        project = import_project(str(FIXTURES / "valid-project"))

        db = get_db(setup_db)
        db.execute(
            "UPDATE projects SET path = ? WHERE id = ?",
            (str(project_root), project["projectId"]),
        )
        db.commit()
        (project_root / ".harness").rmdir()
        project_root.rmdir()

        with pytest.raises(ValueError, match="PROJECT_PATH_MISSING"):
            resolve_project_root(project["projectId"])

    def test_update_active_run(self):
        root = FIXTURES / "valid-project"
        project = import_project(str(root))

        updated = update_active_run(project["projectId"], "run-002")

        assert updated["activeRunId"] == "run-002"


class TestValidateProject:
    """Validate without registering."""

    def test_validate_valid_project(self):
        root = FIXTURES / "valid-project"
        result = validate_project(str(root))
        assert result["health"] == "healthy"

    def test_validate_non_harness_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = validate_project(tmp)
            assert result["health"] == "degraded"
            assert any("NO_HARNESS_DIR" in d["code"] for d in result["diagnostics"])

    def test_validate_invalid_project(self):
        root = FIXTURES / "invalid-run-id"
        result = validate_project(str(root))
        assert result["health"] == "degraded"
        assert len(result["diagnostics"]) > 0
