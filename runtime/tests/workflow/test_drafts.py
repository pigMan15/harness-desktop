"""Tests for Workflow Draft Service (Task 4.1)."""

import tempfile
from pathlib import Path

import pytest

from harness_runtime.workflow.drafts import (
    apply_draft,
    compile_draft,
    get_draft,
    list_drafts,
    save_draft,
    semantic_diff,
    simulate_draft,
)
from harness_runtime.workflow.versioning import get_version, list_versions, save_version

VALID_WF = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1" / "valid-project" / ".harness"

PROJECT_ID = "test-project-001"


@pytest.fixture(autouse=True)
def setup_db(monkeypatch, tmp_path):
    """Use temp database for tests."""
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(
        "harness_runtime.workflow.drafts.get_db",
        lambda: __import__("harness_runtime.persistence.database", fromlist=["get_db"]).get_db(db_path),
    )
    monkeypatch.setattr(
        "harness_runtime.workflow.versioning.get_db",
        lambda: __import__("harness_runtime.persistence.database", fromlist=["get_db"]).get_db(db_path),
    )
    from harness_runtime.persistence.database import init_db
    init_db(db_path)


class TestDraftCRUD:
    """Save, get, list drafts."""

    def test_save_and_get(self):
        save_draft(PROJECT_ID, "test", "nodes: []")
        draft = get_draft(PROJECT_ID, "test")
        assert draft is not None
        assert draft["yaml_content"] == "nodes: []"

    def test_list_drafts(self):
        save_draft(PROJECT_ID, "draft-a", "a")
        save_draft(PROJECT_ID, "draft-b", "b")
        drafts = list_drafts(PROJECT_ID)
        names = [d["name"] for d in drafts]
        assert "draft-a" in names
        assert "draft-b" in names

    def test_update_existing(self):
        save_draft(PROJECT_ID, "test", "v1")
        save_draft(PROJECT_ID, "test", "v2")
        draft = get_draft(PROJECT_ID, "test")
        assert draft["yaml_content"] == "v2"


class TestCompileDraft:
    """Compile drafts using the existing compiler."""

    def test_compile_valid(self):
        wf_yaml = (VALID_WF / "workflow.yaml").read_text(encoding="utf-8")
        result = compile_draft(wf_yaml, "FEATURE", "HIGH")
        assert result["success"]
        assert len(result["route"]["required_nodes"]) >= 20

    def test_compile_invalid_yaml(self):
        result = compile_draft("not: [valid: yaml: {{{", "FEATURE", "LOW")
        assert not result["success"]

    def test_simulate(self):
        wf_yaml = (VALID_WF / "workflow.yaml").read_text(encoding="utf-8")
        result = simulate_draft(wf_yaml, "QUERY", "NA")
        assert "error" not in result or result.get("required_nodes")


class TestSemanticDiff:
    """Semantic diff between two workflow YAMLs."""

    def test_added_node(self):
        old = "nodes:\n- id: INTAKE\n  role: dispatcher\n  artifact: 00-intake.md"
        new = "nodes:\n- id: INTAKE\n  role: dispatcher\n  artifact: 00-intake.md\n- id: CUSTOM\n  role: developer\n  artifact: custom.md"
        diff = semantic_diff(old, new)
        assert "CUSTOM" in diff["nodes"]["added"]

    def test_removed_node(self):
        old = "nodes:\n- id: INTAKE\n  role: dispatcher\n  artifact: 00-intake.md\n- id: EXTRA\n  role: developer\n  artifact: e.md"
        new = "nodes:\n- id: INTAKE\n  role: dispatcher\n  artifact: 00-intake.md"
        diff = semantic_diff(old, new)
        assert "EXTRA" in diff["nodes"]["removed"]


class TestApplyDraft:
    """Apply draft to project (atomic with lock)."""

    @pytest.fixture
    def tmp_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".harness").mkdir()
            yield root

    def test_apply_creates_workflow(self, tmp_project):
        yaml = "nodes: []\nroutes: {}\n"
        result = apply_draft(tmp_project, yaml)
        assert result["success"]
        assert (tmp_project / ".harness" / "workflow.yaml").is_file()

    def test_hash_mismatch(self, tmp_project):
        yaml1 = "nodes: []\nroutes: {}\n"
        apply_draft(tmp_project, yaml1)
        result = apply_draft(tmp_project, yaml1, expected_hash="deadbeef" * 8)
        assert not result["success"]
        assert result["error"] == "HASH_MISMATCH"


class TestVersioning:
    """Save and list workflow versions."""

    @pytest.fixture(autouse=True)
    def _ensure_project(self):
        """Ensure the project exists in the projects table (FK constraint)."""
        from harness_runtime.workflow.versioning import get_db
        db = get_db()
        db.execute(
            "INSERT OR IGNORE INTO projects (id, name, path) VALUES (?, ?, ?)",
            (PROJECT_ID, "test-project", "/tmp/test"),
        )
        db.commit()

    def test_save_and_list(self):
        save_version(PROJECT_ID, "nodes: []\nroutes: {}\n", author="test", summary="init")
        versions = list_versions(PROJECT_ID)
        assert len(versions) >= 1
        assert versions[0]["author"] == "test"

    def test_get_version(self):
        save_version(PROJECT_ID, "v1 content", author="a", summary="first")
        versions = list_versions(PROJECT_ID)
        vid = versions[0]["id"]
        v = get_version(PROJECT_ID, vid)
        assert v is not None
        assert v["yaml_content"] == "v1 content"
