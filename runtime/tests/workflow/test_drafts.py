"""Tests for Workflow Draft Service (Task 4.1)."""

import hashlib
import shutil
import tempfile
from pathlib import Path

import pytest
import yaml

from harness_runtime.workflow.drafts import (
    apply_draft,
    compile_draft,
    get_draft,
    list_drafts,
    preview_structured_draft,
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
        yaml_content = (VALID_WF / "workflow.yaml").read_text(encoding="utf-8")
        result = apply_draft(tmp_project, yaml_content)
        assert result["success"]
        assert (tmp_project / ".harness" / "workflow.yaml").is_file()

    def test_apply_rejects_invalid_workflow_before_write(self, tmp_project):
        result = apply_draft(tmp_project, "nodes: []\nroutes: {}\n")

        assert not result["success"]
        assert result["error"] == "WORKFLOW_VALIDATION_FAILED"
        assert not (tmp_project / ".harness" / "workflow.yaml").exists()

    def test_hash_mismatch(self, tmp_project):
        yaml_content = (VALID_WF / "workflow.yaml").read_text(encoding="utf-8")
        apply_draft(tmp_project, yaml_content)
        result = apply_draft(
            tmp_project, yaml_content, expected_hash="deadbeef" * 8
        )
        assert not result["success"]
        assert result["error"] == "HASH_MISMATCH"

    def test_existing_workflow_requires_expected_hash(self, tmp_project):
        yaml_content = "schema_version: '1.0'\nnodes: []\nroutes: {}\n"
        (tmp_project / ".harness" / "workflow.yaml").write_text(
            yaml_content, encoding="utf-8"
        )

        result = apply_draft(tmp_project, yaml_content)

        assert not result["success"]
        assert result["error"] == "EXPECTED_HASH_REQUIRED"


class TestStructuredPreview:
    @pytest.fixture
    def project(self, tmp_path):
        root = tmp_path / "workflow-project"
        shutil.copytree(VALID_WF.parent, root)
        return root

    def test_preview_preserves_unedited_workflow_sections(self, project):
        workflow_path = project / ".harness" / "workflow.yaml"
        original_text = workflow_path.read_text(encoding="utf-8")
        original = yaml.safe_load(original_text)
        nodes = original["nodes"]
        route = list(reversed(original["routes"]["FEATURE"]["LOW"]))

        result = preview_structured_draft(project, nodes, "FEATURE", "LOW", route)

        preview = yaml.safe_load(result["yaml"])
        assert result["success"] is True
        assert preview["routes"]["FEATURE"]["LOW"] == route
        assert preview["routes"]["QUERY"] == original["routes"]["QUERY"]
        assert preview["hard_rules"] == original["hard_rules"]
        assert preview["failure_recovery"] == original["failure_recovery"]
        assert preview["gate_meanings"] == original["gate_meanings"]
        assert result["base_hash"] == hashlib.sha256(original_text.encode()).hexdigest()
        assert "FEATURE" in result["diff"]["routes"]["changed"]
        assert workflow_path.read_text(encoding="utf-8") == original_text

    def test_invalid_role_returns_diagnostic_without_writing(self, project):
        workflow_path = project / ".harness" / "workflow.yaml"
        original_text = workflow_path.read_text(encoding="utf-8")
        workflow = yaml.safe_load(original_text)
        workflow["nodes"][0]["role"] = "missing-role"

        result = preview_structured_draft(
            project,
            workflow["nodes"],
            "FEATURE",
            "LOW",
            workflow["routes"]["FEATURE"]["LOW"],
        )

        assert result["success"] is False
        assert any(d["code"] == "WORKFLOW_UNKNOWN_ROLE" for d in result["diagnostics"])
        assert workflow_path.read_text(encoding="utf-8") == original_text


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
