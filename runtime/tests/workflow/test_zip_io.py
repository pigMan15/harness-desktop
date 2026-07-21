"""Tests for Workflow ZIP Import/Export (Task 4.1)."""

import io
import zipfile

import pytest

from harness_runtime.workflow.zip_io import export_workflow_zip, import_workflow_zip


class TestExport:
    """Export workflow packages as ZIP."""

    def test_export_minimal(self):
        data = export_workflow_zip("nodes: []\nroutes: {}\n")
        assert len(data) > 0
        # Verify it's a valid ZIP
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            names = zf.namelist()
            assert "workflow.yaml" in names

    def test_export_with_agents(self):
        data = export_workflow_zip(
            "nodes: []\nroutes: {}\n",
            agent_files={"dispatcher.md": "# Dispatcher", "developer.md": "# Dev"},
        )
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            assert "agents/dispatcher.md" in zf.namelist()


class TestImport:
    """Import workflow ZIP with security checks."""

    def test_import_valid(self):
        data = export_workflow_zip("nodes: []\nroutes: {}\n")
        result = import_workflow_zip(data)
        assert "nodes:" in result["workflow_yaml"]

    def test_import_missing_workflow_rejected(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("readme.txt", "hello")
        with pytest.raises(ValueError, match="workflow.yaml"):
            import_workflow_zip(buf.getvalue())

    def test_zip_slip_rejected(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("workflow.yaml", "nodes: []\nroutes: {}\n")
            zf.writestr("../escape.txt", "bad")
        with pytest.raises(ValueError, match="traversal"):
            import_workflow_zip(buf.getvalue())

    def test_absolute_path_rejected(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("workflow.yaml", "nodes: []\nroutes: {}\n")
            zf.writestr("/etc/passwd", "bad")
        with pytest.raises(ValueError, match="Absolute path"):
            import_workflow_zip(buf.getvalue())

    def test_oversized_zip_rejected(self):
        # Create a ZIP larger than 10MB
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("workflow.yaml", "nodes: []\nroutes: {}\n")
            zf.writestr("bigfile.txt", "x" * 11_000_000)
        with pytest.raises(ValueError, match="too large"):
            import_workflow_zip(buf.getvalue())
