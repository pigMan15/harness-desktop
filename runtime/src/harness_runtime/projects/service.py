"""Project registry service.

Architecture §6.1: Import, register, unregister, validate .harness projects.
Architecture §5.4: Protocol-incompatible projects return readonly status.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..persistence.database import get_db
from ..protocol.loader import ProtocolLoadError, load_project


def generate_project_id() -> str:
    """Generate a unique project ID."""
    return uuid.uuid4().hex[:12]


def import_project(project_path: str) -> dict:
    """Import a .harness project.

    Validates the project's protocol health, registers it in SQLite,
    and returns a ProjectSummary dict.

    Raises ValueError if the path is not a valid .harness v1.0 project.
    """
    root = Path(project_path).resolve()
    if not root.is_dir():
        raise ValueError(f"Project path does not exist or is not a directory: {project_path}")

    harness_dir = root / ".harness"
    if not harness_dir.is_dir():
        raise ValueError(f"No .harness directory found at {project_path}. Use template initialization?")

    # Validate protocol health
    health = "healthy"
    try:
        project_data = load_project(root, deep_validate=True)
    except ProtocolLoadError as e:
        health = "degraded"
        # Allow import but mark as degraded — user can repair later
        project_data = None

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


def unregister_project(project_id: str) -> bool:
    """Remove a project from the registry (does NOT delete project files)."""
    db = get_db()
    cursor = db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    db.commit()
    return cursor.rowcount > 0


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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
