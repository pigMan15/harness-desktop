"""Knowledge Promotion Service — review and accept knowledge candidates.

Architecture §6.4: KNOWLEDGE_PROMOTION generates candidate drafts.
Writing to long-term knowledge base requires human review/accept.
"""

from datetime import datetime, timezone

from ..persistence.database import get_db


def _ensure_table():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            run_id TEXT NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'case',
            summary TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            reviewer TEXT,
            reviewed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    db.commit()


def promote_candidate(
    project_id: str,
    run_id: str,
    title: str,
    summary: str,
    source: str,
    candidate_type: str = "case",
) -> int:
    """Create a knowledge candidate (draft status)."""
    _ensure_table()
    db = get_db()
    cursor = db.execute(
        """INSERT INTO knowledge_candidates (project_id, run_id, title, type, summary, source)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (project_id, run_id, title, candidate_type, summary, source),
    )
    db.commit()
    return cursor.lastrowid


def list_candidates(project_id: str | None = None, status: str | None = None) -> list[dict]:
    """List knowledge candidates, optionally filtered."""
    _ensure_table()
    db = get_db()
    conditions = []
    params = []
    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)
    if status:
        conditions.append("status = ?")
        params.append(status)
    where = " AND ".join(conditions) if conditions else "1=1"
    rows = db.execute(
        f"SELECT * FROM knowledge_candidates WHERE {where} ORDER BY created_at DESC",
        params,
    ).fetchall()
    return [dict(r) for r in rows]


def review_candidate(candidate_id: int, decision: str, reviewer: str = "user") -> dict:
    """Accept or reject a knowledge candidate.

    Architecture §6.4: requires human review/accept before writing to knowledge base.
    """
    _ensure_table()
    if decision not in ("accepted", "rejected"):
        raise ValueError(f"Invalid decision: {decision!r}")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE knowledge_candidates SET status = ?, reviewer = ?, reviewed_at = ? WHERE id = ?",
        (decision, reviewer, now, candidate_id),
    )
    db.commit()
    return {"id": candidate_id, "status": decision, "reviewer": reviewer, "reviewed_at": now}
