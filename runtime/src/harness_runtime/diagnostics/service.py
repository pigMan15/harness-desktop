"""Build bounded diagnostic data without terminal secrets."""

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..persistence.audit import query_events
from ..recovery.service import verify_state_consistency
from ..runs.service import list_runs
from ..terminals.projections import list_sessions

_SECRET_PATTERNS = [
    re.compile(r"(?i)(authorization\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"(?i)((?:api[_-]?key|token|secret|password)\s*[:=]\s*)([^\s,;]+)"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
]


def export_diagnostics(project_id: str, project_root: Path) -> dict:
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "projectId": project_id,
        "projectRoot": str(project_root.resolve()),
        "consistency": verify_state_consistency(project_root),
        "runs": list_runs(project_root)[:100],
        "terminalSessions": list_sessions(project_id)[:100],
        "auditEvents": query_events(project_id=project_id, limit=200),
    }
    # 诊断包只保存有限摘要；任何常见凭证形态在离开 Runtime 前统一脱敏。
    return _redact(payload)


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if not isinstance(value, str):
        return value
    redacted = value
    for pattern in _SECRET_PATTERNS:
        if pattern.groups >= 2:
            redacted = pattern.sub(r"\1[REDACTED]", redacted)
        else:
            redacted = pattern.sub("[REDACTED]", redacted)
    return redacted
