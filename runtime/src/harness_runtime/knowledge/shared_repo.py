"""Shared knowledge repository integration.

The desktop app keeps reviewed knowledge candidates in Harness' local database,
but long-term shared knowledge lives in a user-selected Git repository.  This
module manages that repository without pushing anything unless the user asks.
"""

from __future__ import annotations

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from ..persistence.database import get_db
from .service import list_candidates_with_content


RULE_FILES = (
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "knowledge-rules.md",
    ".harness/knowledge-rules.md",
    ".harness/PROJECT-INTEGRATION-GUIDE.md",
)


def _ensure_table() -> None:
    db = get_db()
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_repo_configs (
            project_id TEXT PRIMARY KEY,
            local_path TEXT NOT NULL,
            remote_url TEXT NOT NULL DEFAULT '',
            branch TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        )
        """
    )
    db.commit()


def configure_repo(project_id: str, local_path: str, remote_url: str = "", branch: str = "") -> dict:
    path = _normalize_local_path(local_path)
    detected = inspect_local_path(str(path))
    if detected.get("isGitRepo"):
        remote_url = remote_url.strip() or str(detected.get("remoteUrl") or "")
        branch = branch.strip() or str(detected.get("branch") or "")
    _ensure_table()
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        """INSERT INTO knowledge_repo_configs (project_id, local_path, remote_url, branch, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(project_id) DO UPDATE SET
             local_path = excluded.local_path,
             remote_url = excluded.remote_url,
             branch = excluded.branch,
             updated_at = excluded.updated_at""",
        (project_id, str(path), remote_url.strip(), branch.strip(), now),
    )
    db.commit()
    return repo_status(project_id)


def inspect_local_path(local_path: str) -> dict:
    path = _normalize_local_path(local_path)
    exists = path.exists()
    is_git_repo = exists and (path / ".git").exists()
    remote_url = ""
    branch = ""
    if is_git_repo:
        remote_url = _git(path, "remote", "get-url", "origin", check=False)["stdout"].strip()
        branch = _git(path, "branch", "--show-current", check=False)["stdout"].strip()
    return {
        "localPath": str(path),
        "exists": exists,
        "isGitRepo": is_git_repo,
        "remoteUrl": remote_url,
        "branch": branch,
        "rules": _discover_rules(path) if exists else [],
    }


def repo_status(project_id: str) -> dict:
    config = _get_config(project_id)
    if not config:
        return {"configured": False}
    path = Path(config["localPath"])
    exists = path.exists()
    is_git_repo = exists and (path / ".git").exists()
    status_short = ""
    branch = config.get("branch") or ""
    last_commit = ""
    if is_git_repo:
        branch = _git(path, "branch", "--show-current", check=False)["stdout"].strip() or branch
        status_short = _git(path, "status", "--short", check=False)["stdout"]
        last_commit = _git(path, "log", "-1", "--pretty=%h %s", check=False)["stdout"].strip()
    return {
        **config,
        "configured": True,
        "exists": exists,
        "isGitRepo": is_git_repo,
        "branch": branch,
        "dirty": bool(status_short.strip()),
        "statusShort": status_short,
        "lastCommit": last_commit,
        "rules": _discover_rules(path) if exists else [],
    }


def pull_repo(project_id: str) -> dict:
    config = _require_config(project_id)
    path = Path(config["localPath"])
    remote_url = config.get("remoteUrl") or ""
    if not path.exists():
        if not remote_url:
            raise ValueError("KNOWLEDGE_REPO_REMOTE_REQUIRED: local path does not exist")
        path.parent.mkdir(parents=True, exist_ok=True)
        _git(None, "clone", remote_url, str(path))
    elif not (path / ".git").exists():
        raise ValueError(f"KNOWLEDGE_REPO_NOT_GIT: {path}")
    else:
        _git(path, "pull", "--ff-only")
    return repo_status(project_id)


def push_repo(project_id: str) -> dict:
    config = _require_config(project_id)
    path = Path(config["localPath"])
    _require_git_repo(path)
    _git(path, "add", "-A")
    staged = _git(path, "diff", "--cached", "--quiet", check=False)
    if staged["returncode"] == 1:
        _git(path, "commit", "-m", "Promote Harness knowledge")
    result = _git(path, "push")
    status = repo_status(project_id)
    status["pushOutput"] = result["stdout"] or result["stderr"]
    return status


def synthesize_preview(project_id: str, project_root: Path, candidate_ids: Iterable[int]) -> dict:
    config = _require_config(project_id)
    path = Path(config["localPath"])
    _require_git_repo(path)
    selected_ids = {int(candidate_id) for candidate_id in candidate_ids}
    if not selected_ids:
        raise ValueError("KNOWLEDGE_CANDIDATES_REQUIRED")

    accepted = list_candidates_with_content(project_id, project_root, status="accepted")
    selected = [candidate for candidate in accepted if int(candidate.get("id", 0)) in selected_ids]
    if len(selected) != len(selected_ids):
        found = {int(candidate.get("id", 0)) for candidate in selected}
        missing = sorted(selected_ids - found)
        raise ValueError(f"ACCEPTED_KNOWLEDGE_CANDIDATE_NOT_FOUND: {missing}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    project_slug = _slug(project_id)
    target_dir = path / "harness-inbox" / project_slug
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{stamp}-knowledge-update.md"
    content = _render_update_document(project_id, path, selected)
    target.write_text(content, encoding="utf-8")

    relative = target.relative_to(path).as_posix()
    diff = _git(path, "diff", "--", relative, check=False)["stdout"]
    if not diff:
        diff = _render_untracked_diff(relative, content)
    status = repo_status(project_id)
    return {
        "ok": True,
        "repo": status,
        "files": [relative],
        "diff": diff,
        "manualPushCommand": f"git -C \"{path}\" add \"{relative}\" && git -C \"{path}\" commit -m \"Promote Harness knowledge\" && git -C \"{path}\" push",
    }


def synthesis_context(
    project_id: str,
    project_root: Path,
    candidate_ids: Iterable[int],
    allow_dirty: bool = False,
) -> dict:
    config = _require_config(project_id)
    path = Path(config["localPath"])
    _require_git_repo(path)
    status = repo_status(project_id)
    if status.get("dirty") and not allow_dirty:
        raise ValueError("KNOWLEDGE_REPO_DIRTY: commit, stash, or discard local changes before Codex synthesis")
    selected_ids = {int(candidate_id) for candidate_id in candidate_ids}
    if not selected_ids:
        raise ValueError("KNOWLEDGE_CANDIDATES_REQUIRED")

    accepted = list_candidates_with_content(project_id, project_root, status="accepted")
    selected = [candidate for candidate in accepted if int(candidate.get("id", 0)) in selected_ids]
    if len(selected) != len(selected_ids):
        found = {int(candidate.get("id", 0)) for candidate in selected}
        missing = sorted(selected_ids - found)
        raise ValueError(f"ACCEPTED_KNOWLEDGE_CANDIDATE_NOT_FOUND: {missing}")

    return {
        "repoPath": str(path),
        "prompt": _render_codex_prompt(project_id, path, selected),
        "rules": _discover_rules(path),
        "candidateCount": len(selected),
    }


def repo_diff(project_id: str) -> dict:
    config = _require_config(project_id)
    path = Path(config["localPath"])
    _require_git_repo(path)
    diff = _git(path, "diff", check=False)["stdout"]
    untracked = _git(path, "ls-files", "--others", "--exclude-standard", check=False)["stdout"]
    for relative in [line.strip() for line in untracked.splitlines() if line.strip()]:
        file_path = path / relative
        if file_path.is_file():
            content = file_path.read_text(encoding="utf-8", errors="replace")
            diff += ("\n" if diff else "") + _render_untracked_diff(relative.replace("\\", "/"), content)
    return {
        "ok": True,
        "repo": repo_status(project_id),
        "diff": diff,
        "manualPushCommand": f"git -C \"{path}\" add -A && git -C \"{path}\" commit -m \"Promote Harness knowledge\" && git -C \"{path}\" push",
    }


def _get_config(project_id: str) -> dict | None:
    _ensure_table()
    row = get_db().execute(
        "SELECT project_id, local_path, remote_url, branch, updated_at FROM knowledge_repo_configs WHERE project_id = ?",
        (project_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "projectId": row["project_id"],
        "localPath": row["local_path"],
        "remoteUrl": row["remote_url"],
        "branch": row["branch"],
        "updatedAt": row["updated_at"],
    }


def _require_config(project_id: str) -> dict:
    config = _get_config(project_id)
    if not config:
        raise ValueError("KNOWLEDGE_REPO_NOT_CONFIGURED")
    return config


def _normalize_local_path(local_path: str) -> Path:
    value = local_path.strip()
    if not value:
        raise ValueError("KNOWLEDGE_REPO_LOCAL_PATH_REQUIRED")
    return Path(value).expanduser().resolve()


def _require_git_repo(path: Path) -> None:
    if not path.exists():
        raise ValueError(f"KNOWLEDGE_REPO_NOT_FOUND: {path}")
    if not (path / ".git").exists():
        raise ValueError(f"KNOWLEDGE_REPO_NOT_GIT: {path}")


def _git(cwd: Path | None, *args: str, check: bool = True) -> dict:
    proc = subprocess.run(
        ["git", *(["-C", str(cwd)] if cwd else []), *args],
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode != 0:
        raise ValueError((proc.stderr or proc.stdout or "git command failed").strip())
    return {"returncode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr}


def _discover_rules(repo_root: Path) -> list[dict]:
    rules: list[dict] = []
    for relative in RULE_FILES:
        path = repo_root / relative
        if path.is_file():
            rules.append({"path": relative, "bytes": path.stat().st_size})
    return rules


def _read_rule_excerpt(repo_root: Path) -> str:
    parts: list[str] = []
    for rule in _discover_rules(repo_root):
        path = repo_root / rule["path"]
        text = path.read_text(encoding="utf-8", errors="replace")[:4000].strip()
        if text:
            parts.append(f"### {rule['path']}\n\n{text}")
    return "\n\n".join(parts) or "_No shared knowledge rules were found in the repository._"


def _render_update_document(project_id: str, repo_root: Path, candidates: list[dict]) -> str:
    rules = _read_rule_excerpt(repo_root)
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Harness Knowledge Update Draft",
        "",
        f"- Project: `{project_id}`",
        f"- Generated at: `{now}`",
        f"- Selected candidates: `{len(candidates)}`",
        "",
        "## Shared repository rules used as context",
        "",
        rules,
        "",
        "## Codex synthesis instruction",
        "",
        "Use the shared repository rules above and the approved Harness knowledge candidates below to update the repository documentation. Keep existing knowledge, merge duplicate ideas, and preserve the repository's style. This file is intentionally written into the local Git repository first so the user can preview the diff before pushing.",
        "",
        "## Approved candidates",
        "",
    ]
    for candidate in candidates:
        lines.extend(
            [
                f"### {candidate.get('title') or 'Untitled'}",
                "",
                f"- Candidate ID: `{candidate.get('id')}`",
                f"- Run: `{candidate.get('run_id') or ''}`",
                f"- Type: `{candidate.get('type') or 'case'}`",
                f"- Source: `{candidate.get('source') or ''}`",
                "",
                str(candidate.get("summary") or "").strip(),
                "",
            ]
        )
        content = str(candidate.get("content") or "").strip()
        if content:
            lines.extend(["#### Source artifact", "", content, ""])
    return "\n".join(lines).rstrip() + "\n"


def _render_codex_prompt(project_id: str, repo_root: Path, candidates: list[dict]) -> str:
    candidate_lines: list[str] = []
    for candidate in candidates:
        content = str(candidate.get("content") or "").strip()
        if len(content) > 12000:
            content = content[:12000] + "\n\n[TRUNCATED]"
        candidate_lines.extend(
            [
                f"## Candidate {candidate.get('id')}: {candidate.get('title') or 'Untitled'}",
                "",
                f"- Project: `{project_id}`",
                f"- Run: `{candidate.get('run_id') or ''}`",
                f"- Type: `{candidate.get('type') or 'case'}`",
                f"- Source: `{candidate.get('source') or ''}`",
                "",
                "### Summary",
                "",
                str(candidate.get("summary") or "").strip(),
                "",
                "### Source artifact",
                "",
                content or "_No source content available._",
                "",
            ]
        )
    return (
        "You are updating a shared knowledge repository from approved Harness knowledge promotion records.\n\n"
        "Repository instructions:\n"
        "- Treat the current working directory as the shared knowledge repository.\n"
        "- Read and follow the repository's own knowledge rules and templates, including AGENTS.md, CLAUDE.md, README.md, .harness files, and any templates you find.\n"
        "- Use the approved candidates below as the source data.\n"
        "- Generate or update the appropriate knowledge documents in the repository's existing structure.\n"
        "- Merge with existing content instead of duplicating the same idea.\n"
        "- Do not run git push. Do not create a commit. Leave changes in the local working tree for Harness Desktop to preview.\n"
        "- If the correct destination is ambiguous, create a clearly named draft under harness-inbox/ and explain the ambiguity in that draft.\n\n"
        "Approved Harness knowledge candidates:\n\n"
        + "\n".join(candidate_lines)
    )


def _render_untracked_diff(relative_path: str, content: str) -> str:
    added = "\n".join(f"+{line}" for line in content.splitlines())
    return (
        f"diff --git a/{relative_path} b/{relative_path}\n"
        "new file mode 100644\n"
        "index 0000000..0000000\n"
        "--- /dev/null\n"
        f"+++ b/{relative_path}\n"
        "@@ -0,0 +1 @@\n"
        f"{added}\n"
    )


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-._")
    return slug or "project"
