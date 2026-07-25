"""Git worktree lifecycle for concurrently executing Runs."""

import shutil
import subprocess
from pathlib import Path


class WorktreeUnavailable(RuntimeError):
    """The project cannot provide the isolated worktree required for execution."""


def _git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "-c", "core.longpaths=true", *args],
            cwd=cwd,
            check=check,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise WorktreeUnavailable("GIT_EXECUTABLE_NOT_FOUND") from exc
    except subprocess.CalledProcessError as exc:
        message = (exc.stderr or exc.stdout or "git command failed").strip()
        raise WorktreeUnavailable(message) from exc


def ensure_run_worktree(project_root: Path, run_id: str) -> dict[str, str]:
    """Create or reuse the branch/worktree assigned to one Run.

    每个 Run 使用独立目录，避免两个 Codex session 直接覆盖同一工作树；冲突只在
    后续显式 Git 合并时处理。
    """
    root = project_root.resolve()
    probe = _git(root, "rev-parse", "--show-toplevel", check=False)
    if probe.returncode != 0:
        raise WorktreeUnavailable("GIT_REPOSITORY_REQUIRED")
    git_root = Path(probe.stdout.strip()).resolve()
    try:
        project_relative = root.relative_to(git_root)
    except ValueError as exc:
        raise WorktreeUnavailable("PROJECT_OUTSIDE_GIT_ROOT") from exc

    branch_name = f"codex/{run_id}"
    worktrees_root = git_root.parent / f".{git_root.name}-harness-worktrees"
    repository_worktree = (worktrees_root / run_id).resolve()
    project_worktree = repository_worktree / project_relative

    if not (repository_worktree / ".git").exists():
        worktrees_root.mkdir(parents=True, exist_ok=True)
        branch_exists = _git(
            git_root, "show-ref", "--verify", "--quiet", f"refs/heads/{branch_name}", check=False
        ).returncode == 0
        if branch_exists:
            _git(git_root, "worktree", "add", str(repository_worktree), branch_name)
        else:
            _git(git_root, "worktree", "add", "-b", branch_name, str(repository_worktree), "HEAD")

    if not project_worktree.is_dir():
        raise WorktreeUnavailable(f"WORKTREE_PROJECT_PATH_MISSING: {project_worktree}")
    _sync_harness_metadata(root, project_worktree)
    return {
        "branch_name": branch_name,
        "worktree_path": str(project_worktree),
        "worktree_status": "ready",
    }


def _sync_harness_metadata(source_root: Path, target_root: Path) -> None:
    """Ensure Codex guidance files exist in the run worktree.

    Git worktrees are created from committed HEAD and cannot see import-time staged or
    untracked Harness files. Copy missing Harness metadata so terminal sessions launched in
    the run worktree still receive `.harness`, `AGENTS.md`, and `CLAUDE.md` guidance.
    """
    for relative in (".harness", "AGENTS.md", "CLAUDE.md"):
        source = source_root / relative
        target = target_root / relative
        if not source.exists() or target.exists():
            continue
        if source.is_symlink():
            raise WorktreeUnavailable(f"HARNESS_SYNC_SYMLINK_REJECTED: {source}")
        if source.is_dir():
            shutil.copytree(source, target, symlinks=False)
        elif source.is_file():
            shutil.copy2(source, target)
