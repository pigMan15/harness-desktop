"""Request idempotency middleware — architecture §11: all commands use request_id."""

import json

from ..persistence.database import get_db


def check_idempotent(request_id: str) -> dict | None:
    """Check if a request_id has been processed before.

    Returns the cached response if found, None if this is a new request.
    Architecture §6.1: duplicate requests return the original result.
    """
    db = get_db()
    row = db.execute(
        "SELECT response_json FROM request_dedup WHERE request_id = ?",
        (request_id,),
    ).fetchone()
    if row:
        return json.loads(row["response_json"])
    return None


def store_idempotent(request_id: str, response: dict) -> None:
    """Store a response for future idempotent checks."""
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO request_dedup (request_id, response_json) VALUES (?, ?)",
        (request_id, json.dumps(response, ensure_ascii=False)),
    )
    db.commit()
