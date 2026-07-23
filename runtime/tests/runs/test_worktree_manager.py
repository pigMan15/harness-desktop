"""Run worktree isolation tests."""

import subprocess
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


def test_non_git_project_is_explicitly_unavailable(tmp_path):
    with pytest.raises(WorktreeUnavailable, match="GIT_REPOSITORY_REQUIRED"):
        ensure_run_worktree(tmp_path, "development-run")
