"""Rebuildable terminal session summaries."""

from datetime import datetime, timezone

from ..persistence.database import get_db, init_db

ACTIVE = {"starting", "running"}


def upsert_session(project_id: str, session: dict) -> dict:
    """Persist a Main-owned terminal summary while enforcing run/node ownership."""
    init_db()
    required = {"sessionId", "runId", "nodeId", "status", "startedAt"}
    missing = sorted(required - session.keys())
    if missing:
        raise ValueError(f"TERMINAL_PROJECTION_FIELDS_MISSING: {','.join(missing)}")
    if session["status"] in ACTIVE:
        row = get_db().execute(
            """SELECT id FROM terminal_sessions
               WHERE project_id = ? AND run_id = ? AND node_id = ?
                 AND status IN ('starting', 'running') AND id <> ?""",
            (project_id, session["runId"], session["nodeId"], session["sessionId"]),
        ).fetchone()
        if row:
            raise RuntimeError("TERMINAL_SESSION_ALREADY_ACTIVE")
    now = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.execute(
        """INSERT INTO terminal_sessions
           (id, project_id, run_id, node_id, kind, executable_path, cwd, pid, status,
            cols, rows, sequence, started_at, ended_at, exit_code, summary, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status=excluded.status, pid=excluded.pid, cols=excluded.cols,
             rows=excluded.rows, sequence=excluded.sequence, ended_at=excluded.ended_at,
             exit_code=excluded.exit_code, summary=excluded.summary, updated_at=excluded.updated_at""",
        (
            session["sessionId"],
            project_id,
            session["runId"],
            session["nodeId"],
            session.get("kind", "codex"),
            session.get("executablePath", ""),
            session.get("cwd", ""),
            session.get("pid"),
            session["status"],
            int(session.get("cols", 120)),
            int(session.get("rows", 30)),
            int(session.get("sequence", 0)),
            session["startedAt"],
            session.get("endedAt"),
            session.get("exitCode"),
            session.get("summary", "")[:2000],
            now,
        ),
    )
    db.commit()
    return get_session(project_id, session["sessionId"])


def get_session(project_id: str, session_id: str) -> dict:
    init_db()
    row = get_db().execute(
        "SELECT * FROM terminal_sessions WHERE project_id = ? AND id = ?",
        (project_id, session_id),
    ).fetchone()
    if not row:
        raise ValueError(f"TERMINAL_SESSION_NOT_FOUND: {session_id}")
    return _to_dict(row)


def list_sessions(project_id: str, run_id: str | None = None) -> list[dict]:
    init_db()
    db = get_db()
    if run_id:
        rows = db.execute(
            """SELECT * FROM terminal_sessions WHERE project_id = ? AND run_id = ?
               ORDER BY started_at DESC""",
            (project_id, run_id),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM terminal_sessions WHERE project_id = ? ORDER BY started_at DESC",
            (project_id,),
        ).fetchall()
    return [_to_dict(row) for row in rows]


def interrupt_active_sessions(project_id: str | None = None) -> int:
    """Shutdown changes only terminal projections; Harness nodes remain untouched."""
    init_db()
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    if project_id:
        cursor = db.execute(
            """UPDATE terminal_sessions SET status='interrupted', ended_at=?, updated_at=?
               WHERE project_id=? AND status IN ('starting','running')""",
            (now, now, project_id),
        )
    else:
        cursor = db.execute(
            """UPDATE terminal_sessions SET status='interrupted', ended_at=?, updated_at=?
               WHERE status IN ('starting','running')""",
            (now, now),
        )
    db.commit()
    return cursor.rowcount


def _to_dict(row) -> dict:
    return {
        "sessionId": row["id"],
        "projectId": row["project_id"],
        "runId": row["run_id"],
        "nodeId": row["node_id"],
        "kind": row["kind"],
        "executablePath": row["executable_path"],
        "cwd": row["cwd"],
        "pid": row["pid"],
        "status": row["status"],
        "cols": row["cols"],
        "rows": row["rows"],
        "sequence": row["sequence"],
        "startedAt": row["started_at"],
        "endedAt": row["ended_at"],
        "exitCode": row["exit_code"],
        "summary": row["summary"],
    }
