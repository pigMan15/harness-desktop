"""Run worktree isolation tests."""

import subprocess
import tempfile
from pathlib import Path

import pytest

from harness_runtime.runs.worktrees import WorktreeUnavailable, ensure_run_worktree


def _git(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True
    )
    return result.stdout.strip()


def test_two_runs_modify_same_file_in_distinct_worktrees(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    _git(root, "init")
    _git(root, "config", "user.email", "test@example.com")
    _git(root, "config", "user.name", "Harness Test")
    (root / "shared.txt").write_text("base\n", encoding="utf-8")
    _git(root, "add", "shared.txt")
    _git(root, "commit", "-m", "base")

    first = ensure_run_worktree(root, "parallel-first")
    second = ensure_run_worktree(root, "parallel-second")
    first_path = Path(first["worktree_path"])
    second_path = Path(second["worktree_path"])

    (first_path / "shared.txt").write_text("first\n", encoding="utf-8")
    (second_path / "shared.txt").write_text("second\n", encoding="utf-8")

    assert first["branch_name"] == "codex/parallel-first"
    assert second["branch_name"] == "codex/parallel-second"
    assert first_path != second_path
    assert (first_path / "shared.txt").read_text(encoding="utf-8") == "first\n"
    assert (second_path / "shared.txt").read_text(encoding="utf-8") == "second\n"
    assert (root / "shared.txt").read_text(encoding="utf-8") == "base\n"


def test_worktree_receives_uncommitted_harness_metadata(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    _git(root, "init")
    _git(root, "config", "user.email", "test@example.com")
    _git(root, "config", "user.name", "Harness Test")
    (root / "tracked.txt").write_text("base\n", encoding="utf-8")
    _git(root, "add", "tracked.txt")
    _git(root, "commit", "-m", "base")

    harness = root / ".harness"
    (harness / "agents").mkdir(parents=True)
    (harness / "agents" / "dispatcher.md").write_text("dispatcher\n", encoding="utf-8")
    (harness / "workflow.yaml").write_text("schema_version: '1.0'\n", encoding="utf-8")
    (root / "AGENTS.md").write_text("agents guide\n", encoding="utf-8")
    (root / "CLAUDE.md").write_text("claude guide\n", encoding="utf-8")

    assigned = ensure_run_worktree(root, "metadata-sync")
    worktree = Path(assigned["worktree_path"])

    assert (worktree / ".harness" / "workflow.yaml").read_text(encoding="utf-8")
    assert (worktree / ".harness" / "agents" / "dispatcher.md").is_file()
    assert (worktree / "AGENTS.md").read_text(encoding="utf-8") == "agents guide\n"
    assert (worktree / "CLAUDE.md").read_text(encoding="utf-8") == "claude guide\n"


def test_non_git_project_is_explicitly_unavailable(tmp_path):
    with tempfile.TemporaryDirectory() as tmp:
        with pytest.raises(WorktreeUnavailable, match="GIT_REPOSITORY_REQUIRED"):
            ensure_run_worktree(Path(tmp), "development-run")
