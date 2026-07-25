"""Knowledge Promotion Service — review and accept knowledge candidates.

Architecture §6.4: KNOWLEDGE_PROMOTION generates candidate drafts.
Writing to long-term knowledge base requires human review/accept.
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

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


def list_candidates_with_content(project_id: str, project_root: Path, status: str | None = None) -> list[dict]:
    sync_phase_candidates(project_id, project_root)
    candidates = list_candidates(project_id=project_id, status=status)
    for candidate in candidates:
        source = str(candidate.get("source") or "")
        source_path = Path(source)
        if not source_path.is_absolute():
            source_path = (project_root / source).resolve()
        if not source_path.is_file():
            continue
        try:
            candidate["content"] = source_path.read_text(encoding="utf-8", errors="replace")
            candidate["contentType"] = "markdown" if source_path.suffix.lower() == ".md" else "text"
        except OSError:
            continue
    return _dedupe_candidates(candidates)


def sync_phase_candidates(project_id: str, project_root: Path) -> None:
    """Import existing 19-knowledge-promotion.md artifacts as review drafts."""
    _ensure_table()
    runs_dir = project_root / ".harness" / "runs"
    if not runs_dir.is_dir():
        return
    db = get_db()
    for state_path in runs_dir.glob("*/state.json"):
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        run_id = str(state.get("run_id") or state_path.parent.name)
        completed = state.get("completed_nodes") or []
        if state.get("current_node") != "KNOWLEDGE_PROMOTION" and "KNOWLEDGE_PROMOTION" not in completed:
            continue
        phase_dir_value = str(state.get("phase_dir") or "")
        if not phase_dir_value:
            continue
        phase_dir = (project_root / phase_dir_value).resolve()
        source_path = phase_dir / "19-knowledge-promotion.md"
        if not source_path.is_file() and state.get("worktree_path"):
            worktree_phase_dir = (Path(str(state["worktree_path"])) / phase_dir_value).resolve()
            source_path = worktree_phase_dir / "19-knowledge-promotion.md"
        if not source_path.is_file():
            continue
        try:
            source = str(source_path.relative_to(project_root.resolve()))
        except ValueError:
            source = str(source_path)
        content = source_path.read_text(encoding="utf-8", errors="replace")
        title, summary = _summarize_markdown_candidate(run_id, content)
        exists = db.execute(
            """SELECT 1 FROM knowledge_candidates
               WHERE project_id = ? AND run_id = ? AND type = ? AND title = ? AND summary = ?""",
            (project_id, run_id, "case", title, summary),
        ).fetchone()
        if exists:
            continue
        db.execute(
            """INSERT INTO knowledge_candidates (project_id, run_id, title, type, summary, source)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project_id, run_id, title, "case", summary, source),
        )
    db.commit()


def _summarize_markdown_candidate(run_id: str, content: str) -> tuple[str, str]:
    title = f"Knowledge promotion: {run_id}"
    summary_parts: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#"):
            heading = line.lstrip("#").strip()
            if heading and title == f"Knowledge promotion: {run_id}":
                title = heading[:120]
            continue
        summary_parts.append(line.lstrip("-* ").strip())
        if len(" ".join(summary_parts)) >= 220:
            break
    summary = " ".join(summary_parts).strip()
    return title, summary[:300] or "Knowledge promotion artifact is ready for review."


def _dedupe_candidates(candidates: list[dict]) -> list[dict]:
    seen: set[tuple[str, str, str, str, str, str, str]] = set()
    deduped: list[dict] = []
    for candidate in candidates:
        content = str(candidate.get("content") or "")
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest() if content else ""
        key = (
            str(candidate.get("project_id") or ""),
            str(candidate.get("run_id") or ""),
            str(candidate.get("status") or ""),
            str(candidate.get("type") or ""),
            str(candidate.get("title") or ""),
            str(candidate.get("summary") or ""),
            content_hash,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def review_candidate(candidate_id: int, decision: str, reviewer: str = "user") -> dict:
    """Accept or reject a knowledge candidate.

    Architecture §6.4: requires human review/accept before writing to knowledge base.
    """
    _ensure_table()
    if decision not in ("accepted", "rejected"):
        raise ValueError(f"Invalid decision: {decision!r}")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    row = db.execute("SELECT * FROM knowledge_candidates WHERE id = ?", (candidate_id,)).fetchone()
    if not row:
        raise ValueError(f"KNOWLEDGE_CANDIDATE_NOT_FOUND: {candidate_id}")
    db.execute(
        """UPDATE knowledge_candidates
           SET status = ?, reviewer = ?, reviewed_at = ?
           WHERE project_id = ? AND run_id = ? AND type = ? AND title = ? AND summary = ? AND status = ?""",
        (
            decision,
            reviewer,
            now,
            row["project_id"],
            row["run_id"],
            row["type"],
            row["title"],
            row["summary"],
            row["status"],
        ),
    )
    db.commit()
    return {"id": candidate_id, "status": decision, "reviewer": reviewer, "reviewed_at": now}
