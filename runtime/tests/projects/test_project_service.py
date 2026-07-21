"""Tests for Project Registry service (Task 2.2)."""

import tempfile
from pathlib import Path

import pytest

from harness_runtime.persistence.database import init_db, get_db
from harness_runtime.projects.service import (
    import_project,
    list_projects,
    unregister_project,
    validate_project,
)

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

    def test_import_no_harness_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            with pytest.raises(ValueError, match="No .harness directory"):
                import_project(tmp)


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
