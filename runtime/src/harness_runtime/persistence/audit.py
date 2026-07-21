"""Audit Projection — records state changes as SQLite audit events.

Architecture §6.1: each command with request_id is idempotent.
Architecture §13: SQLite audit projection is rebuildable from project .harness/ data.
"""

import json
from datetime import datetime, timezone

from .database import get_db


def record_event(
    project_id: str,
    run_id: str,
    event_type: str,
    node_id: str | None = None,
    gate_id: str | None = None,
    summary: str = "",
) -> int:
    """Record an audit event. Returns the event ID."""
    db = get_db()
    cursor = db.execute(
        """INSERT INTO audit_events (project_id, run_id, node_id, gate_id, event_type, summary)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (project_id, run_id, node_id, gate_id, event_type, summary),
    )
    db.commit()
    return cursor.lastrowid


def query_events(
    project_id: str | None = None,
    run_id: str | None = None,
    event_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Query audit events with optional filters."""
    db = get_db()
    conditions = []
    params: list = []
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)
    if run_id:
        conditions.append("run_id = ?")
        params.append(run_id)
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    where = " AND ".join(conditions) if conditions else "1=1"
    rows = db.execute(
        f"SELECT * FROM audit_events WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    return [dict(r) for r in rows]


def rebuild_audit_from_project(project_id: str, project_path: str) -> dict:
    """Rebuild audit projection from project .harness/ data.

    Architecture §6.1: delete SQLite → rebuild core index from project.
    Architecture §13: audit projection is rebuildable.
    """
    from pathlib import Path
    root = Path(project_path)
    runs_dir = root / ".harness" / "runs"
    count = 0
    if runs_dir.is_dir():
        for run_dir in runs_dir.iterdir():
            if (run_dir / "state.json").is_file():
                try:
                    state = json.load(open(run_dir / "state.json", encoding="utf-8"))
                    run_id = state.get("run_id", run_dir.name)
                    record_event(project_id, run_id, "state_snapshot",
                                 node_id=state.get("current_node"),
                                 summary=f"Rebuilt from snapshot: {run_dir.name}")
                    count += 1
                except Exception:
                    pass
    return {"rebuilt_events": count}
