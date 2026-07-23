"""SQLite database connection and schema management.

Architecture §13: SQLite stores only rebuildable derived data.
The .harness/ directory is the authoritative source.
"""

import sqlite3
from pathlib import Path
from typing import Optional

# Database file location (OQ-1: project root during development)。
DEFAULT_DB_PATH = Path("harness-desktop.db")


def get_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Get a SQLite connection with WAL mode and foreign keys enabled."""
    path = db_path or DEFAULT_DB_PATH
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Initialize the database schema (idempotent — uses IF NOT EXISTS)."""
    conn = get_db(db_path)
    conn.executescript(_SCHEMA_SQL)
    existing = {row[1] for row in conn.execute("PRAGMA table_info(executor_sessions)")}
    # SQLite 的 IF NOT EXISTS 不会补列，启动时做轻量兼容迁移，保留已有 session 数据。
    for name in ("worktree_path", "branch_name", "thread_id", "turn_id"):
        if name not in existing:
            conn.execute(f"ALTER TABLE executor_sessions ADD COLUMN {name} TEXT")
    conn.commit()
    return conn


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    protocol_version TEXT NOT NULL DEFAULT '1.0',
    health TEXT NOT NULL DEFAULT 'unknown',
    active_run_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    yaml_content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'unknown',
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS executor_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    executor_type TEXT NOT NULL DEFAULT 'codex',
    pid INTEGER,
    start_time TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    worktree_path TEXT,
    branch_name TEXT,
    thread_id TEXT,
    turn_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL,
    node_id TEXT,
    gate_id TEXT,
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_dedup (
    request_id TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_project_run ON audit_events(project_id, run_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON executor_sessions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_project_run ON executor_sessions(project_id, run_id, status);
"""
