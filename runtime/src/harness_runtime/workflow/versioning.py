"""Workflow Version Service — save, list, and restore workflow versions.

Architecture §9.3: versions store content hash, author, summary, and timestamp.
Restoring a version applies the same compile/apply pipeline as a new draft.
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional

from ..persistence.database import get_db


def save_version(project_id: str, yaml_content: str, author: str = "unknown", summary: str = "") -> dict:
    """Save a workflow version to SQLite.

    Returns the version metadata including content hash.
    """
    db = get_db()
    content_hash = hashlib.sha256(yaml_content.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        """INSERT INTO workflow_versions (project_id, content_hash, yaml_content, author, summary, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (project_id, content_hash, yaml_content, author, summary, now),
    )
    db.commit()
    return {
        "project_id": project_id,
        "content_hash": content_hash,
        "author": author,
        "summary": summary,
        "created_at": now,
    }


def list_versions(project_id: str) -> list[dict]:
    """List all saved workflow versions for a project."""
    db = get_db()
    rows = db.execute(
        """SELECT id, content_hash, author, summary, created_at
           FROM workflow_versions
           WHERE project_id = ?
           ORDER BY created_at DESC""",
        (project_id,),
    ).fetchall()
    return [
        {
            "id": r["id"],
            "content_hash": r["content_hash"],
            "author": r["author"],
            "summary": r["summary"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def get_version(project_id: str, version_id: int) -> Optional[dict]:
    """Get a specific version's full YAML content."""
    db = get_db()
    row = db.execute(
        "SELECT * FROM workflow_versions WHERE id = ? AND project_id = ?",
        (version_id, project_id),
    ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "content_hash": row["content_hash"],
        "yaml_content": row["yaml_content"],
        "author": row["author"],
        "summary": row["summary"],
        "created_at": row["created_at"],
    }
