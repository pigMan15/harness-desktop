from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.terminals.projections import (
    interrupt_active_sessions,
    list_sessions,
    upsert_session,
)


def test_interrupt_marks_only_active_terminal_projections(tmp_path, monkeypatch):
    db_path = tmp_path / "terminal-projections.db"
    monkeypatch.setattr("harness_runtime.persistence.database.DEFAULT_DB_PATH", db_path)
    init_db(db_path)
    monkeypatch.setattr(
        "harness_runtime.terminals.projections.get_db", lambda: get_db(db_path)
    )
    db = get_db(db_path)
    db.execute(
        "INSERT INTO projects (id, name, path, protocol_version, health) VALUES (?, ?, ?, '1.0', 'healthy')",
        ("project-a", "Project A", str(tmp_path)),
    )
    db.commit()
    for session_id, status in (("active", "running"), ("done", "exited")):
        upsert_session(
            "project-a",
            {
                "sessionId": session_id,
                "runId": "run-a",
                "nodeId": "DEVELOPMENT",
                "status": status,
                "startedAt": "2026-07-24T00:00:00Z",
            },
        )

    assert interrupt_active_sessions("project-a") == 1

    sessions = {item["sessionId"]: item for item in list_sessions("project-a")}
    assert sessions["active"]["status"] == "interrupted"
    assert sessions["active"]["endedAt"]
    assert sessions["done"]["status"] == "exited"
