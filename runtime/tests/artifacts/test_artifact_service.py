"""Tests for Artifact Service (Task 3.5)."""

import tempfile
from pathlib import Path

import pytest

from harness_runtime.artifacts.service import list_artifacts, read_artifact


class TestReadArtifact:
    """Safe artifact reading with path containment."""

    @pytest.fixture
    def tmp_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            phase = root / ".harness" / "phases" / "test-run"
            phase.mkdir(parents=True)
            yield root, phase

    def test_read_markdown(self, tmp_project):
        root, phase = tmp_project
        (phase / "test.md").write_text("# Hello", encoding="utf-8")
        result = read_artifact(root, phase, "test.md")
        assert result["content"] == "# Hello"
        assert result["type"] == "markdown"
        assert len(result["sha256"]) == 64

    def test_read_json(self, tmp_project):
        root, phase = tmp_project
        (phase / "data.json").write_text('{"key": "value"}', encoding="utf-8")
        result = read_artifact(root, phase, "data.json")
        assert result["type"] == "json"

    def test_path_escape_rejected(self, tmp_project):
        root, phase = tmp_project
        # Use an absolute path outside the project root — definitely escapes
        with pytest.raises(ValueError, match="escapes"):
            read_artifact(root, phase, "C:/Windows/System32/drivers/etc/hosts")

    def test_missing_file(self, tmp_project):
        root, phase = tmp_project
        with pytest.raises(FileNotFoundError):
            read_artifact(root, phase, "nonexistent.md")

    def test_empty_phase_dir_list(self, tmp_project):
        root, phase = tmp_project
        result = list_artifacts(phase)
        assert result == []

    def test_list_artifacts(self, tmp_project):
        root, phase = tmp_project
        (phase / "a.md").write_text("a")
        (phase / "b.json").write_text("{}")
        result = list_artifacts(phase)
        assert len(result) == 2
        names = [r["name"] for r in result]
        assert "a.md" in names
        assert "b.json" in names
