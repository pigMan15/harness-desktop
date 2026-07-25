"""Project registry service.

Architecture §6.1: Import, register, unregister, validate .harness projects.
Architecture §5.4: Protocol-incompatible projects return readonly status.
"""

import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ..persistence.database import get_db
from ..protocol.loader import ProtocolLoadError, load_project
from .bootstrap import apply_bootstrap, list_missing_files, rollback_bootstrap


def generate_project_id() -> str:
    """Generate a unique project ID."""
    return uuid.uuid4().hex[:12]


def import_project(project_path: str, decision: str | None = None) -> dict:
    """Import a .harness project.

    Validates the project's protocol health, registers it in SQLite,
    and returns a ProjectSummary dict.

    Raises ValueError if the path is not a valid .harness v1.0 project.
    """
    root = Path(project_path).resolve()
    if not root.is_dir():
        raise ValueError(f"Project path does not exist or is not a directory: {project_path}")

    missing_files = list_missing_files(root)
    if missing_files:
        if decision is None:
            return {
                "confirmationRequired": True,
                "action": "initialize" if not (root / ".harness").exists() else "append",
                "path": str(root),
                "missingFiles": missing_files,
                "missingCount": len(missing_files),
            }
        if decision == "skip":
            if not (root / ".harness").is_dir():
                raise ValueError(
                    "INITIALIZATION_REQUIRED: cannot skip initialization without .harness"
                )
            return _register_project(root, strict=False)
        if decision not in {"initialize", "append"}:
            raise ValueError(f"IMPORT_DECISION_INVALID: {decision}")

        operation = apply_bootstrap(root, decision)
        try:
            summary = _register_project(root, strict=True)
            summary["gitStage"] = _stage_harness_files(root)
            return summary
        except Exception:
            # 确认后的写入失败不能留下半成品，也不能先注册再补救。
            rollback_bootstrap(root, operation)
            raise

    if decision is not None:
        raise ValueError("IMPORT_DECISION_NOT_REQUIRED: project is already complete")
    summary = _register_project(root, strict=False)
    summary["gitStage"] = _stage_harness_files(root)
    return summary


def _register_project(root: Path, strict: bool) -> dict:
    """Validate first, then update the rebuildable registry projection."""

    # Validate protocol health
    health = "healthy"
    try:
        load_project(root, deep_validate=True)
    except ProtocolLoadError:
        if strict:
            raise
        health = "degraded"
        # Allow import but mark as degraded — user can repair later

    # Register in SQLite
    db = get_db()
    project_id = generate_project_id()
    name = root.name
    protocol_version = "1.0"

    existing = db.execute("SELECT id FROM projects WHERE path = ?", (str(root),)).fetchone()
    if existing:
        # Already registered — update health
        db.execute(
            "UPDATE projects SET health = ?, updated_at = ? WHERE id = ?",
            (health, _now(), existing["id"]),
        )
        db.commit()
        return _project_summary(db, existing["id"])

    db.execute(
        """INSERT INTO projects (id, name, path, protocol_version, health)
           VALUES (?, ?, ?, ?, ?)""",
        (project_id, name, str(root), protocol_version, health),
    )
    db.commit()
    return _project_summary(db, project_id)


def list_projects() -> list[dict]:
    """List all registered projects."""
    db = get_db()
    rows = db.execute(
        "SELECT id, name, path, protocol_version, health, active_run_id, created_at, updated_at FROM projects ORDER BY updated_at DESC"
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_project(project_id: str) -> dict:
    """Return one registered project or reject an unknown identifier."""
    if not project_id:
        raise ValueError("PROJECT_ID_REQUIRED: select a project first")
    db = get_db()
    row = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise ValueError(f"PROJECT_NOT_FOUND: {project_id}")
    return _row_to_dict(row)


def resolve_project_root(project_id: str) -> Path:
    """Resolve a registry id to a live Harness project directory.

    # 项目 ID 是所有业务请求的边界，禁止在解析失败时回退到进程 cwd。
    """
    project = get_project(project_id)
    root = Path(project["path"]).resolve()
    if not root.is_dir() or not (root / ".harness").is_dir():
        raise ValueError(f"PROJECT_PATH_MISSING: {project['path']}")
    return root


def update_active_run(project_id: str, run_id: str) -> dict:
    """Update the rebuildable active-run projection for a project."""
    get_project(project_id)
    db = get_db()
    db.execute(
        "UPDATE projects SET active_run_id = ?, updated_at = ? WHERE id = ?",
        (run_id, _now(), project_id),
    )
    db.commit()
    return get_project(project_id)


def unregister_project(project_id: str) -> bool:
    """Remove a project from the registry (does NOT delete project files)."""
    db = get_db()
    cursor = db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    db.commit()
    return cursor.rowcount > 0


def repair_project(project_id: str) -> dict:
    """Append only missing Harness v1 files after an explicit repair command."""
    project = get_project(project_id)
    root = Path(project["path"]).resolve()
    missing = list_missing_files(root)
    if missing:
        apply_bootstrap(root, "append")
    summary = _register_project(root, strict=True)
    summary["gitStage"] = _stage_harness_files(root)
    return summary


def relocate_project(project_id: str, project_path: str) -> dict:
    """Move a registry projection after validating the new authoritative path."""
    get_project(project_id)
    root = Path(project_path).resolve()
    if not root.is_dir():
        raise ValueError(f"PROJECT_PATH_MISSING: {project_path}")
    load_project(root, deep_validate=True)
    db = get_db()
    conflict = db.execute(
        "SELECT id FROM projects WHERE path = ? AND id <> ?",
        (str(root), project_id),
    ).fetchone()
    if conflict:
        raise ValueError(f"PROJECT_PATH_ALREADY_REGISTERED: {project_path}")
    db.execute(
        "UPDATE projects SET path = ?, name = ?, health = 'healthy', updated_at = ? WHERE id = ?",
        (str(root), root.name, _now(), project_id),
    )
    db.commit()
    return get_project(project_id)


def validate_project(project_path: str) -> dict:
    """Validate a project path without registering it.

    Returns {"health": "healthy"|"degraded", "diagnostics": [...]}.
    """
    root = Path(project_path).resolve()
    result = {"health": "healthy", "diagnostics": []}

    if not root.is_dir():
        result["health"] = "degraded"
        result["diagnostics"].append({"code": "PATH_NOT_FOUND", "message": f"Not a directory: {project_path}"})
        return result

    harness_dir = root / ".harness"
    if not harness_dir.is_dir():
        result["health"] = "degraded"
        result["diagnostics"].append({"code": "NO_HARNESS_DIR", "message": f"No .harness directory at {project_path}"})
        return result

    try:
        data = load_project(root, deep_validate=True)
        result["diagnostics"] = data.get("diagnostics", [])
    except ProtocolLoadError as e:
        result["health"] = "degraded"
        result["diagnostics"].append({"code": e.code, "message": e.message, "pointer": e.pointer})

    return result


def _project_summary(db, project_id: str) -> dict:
    row = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_dict(row) if row else {}


def _row_to_dict(row) -> dict:
    return {
        "projectId": row["id"],
        "name": row["name"],
        "path": row["path"],
        "protocolVersion": row["protocol_version"],
        "health": row["health"],
        "activeRunId": row["active_run_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _stage_harness_files(root: Path) -> dict:
    """Stage Harness-owned project files when importing a Git repository.

    Import must not create commits, but staging the generated/updated Harness files ensures
    later `git worktree add` runs inherit `.harness`, `AGENTS.md`, and `CLAUDE.md`.
    """
    candidates = [".harness", "AGENTS.md", "CLAUDE.md"]
    existing = [relative for relative in candidates if (root / relative).exists()]
    if not existing:
        return {"status": "skipped", "reason": "NO_HARNESS_FILES", "files": []}

    probe = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    if probe.returncode != 0:
        return {"status": "skipped", "reason": "GIT_REPOSITORY_REQUIRED", "files": existing}

    result = subprocess.run(
        ["git", "add", "-f", "--", *existing],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "git add failed").strip()
        return {"status": "failed", "reason": message, "files": existing}
    return {"status": "staged", "files": existing}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
