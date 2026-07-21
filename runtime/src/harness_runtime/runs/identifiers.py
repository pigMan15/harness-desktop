"""Run ID validation — architecture §5.1: run_id must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"""

import re
from pathlib import Path

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def validate_run_id(run_id: str, existing_run_ids: set[str] | None = None) -> list[str]:
    """Validate a run_id. Returns a list of error messages (empty = valid).

    Checks:
    - Matches the run_id regex pattern
    - No path traversal (.., /, \\)
    - No drive letter (C:)
    - Not already in use (if existing_run_ids provided)
    """
    errors: list[str] = []
    if not RUN_ID_PATTERN.match(run_id):
        errors.append(f"run_id must match {RUN_ID_PATTERN.pattern}, got {run_id!r}")
    if ".." in run_id or "/" in run_id or "\\" in run_id:
        errors.append(f"run_id contains unsafe path characters: {run_id!r}")
    if ":" in run_id:
        errors.append(f"run_id contains drive letter or colon: {run_id!r}")
    if existing_run_ids and run_id in existing_run_ids:
        errors.append(f"run_id {run_id!r} already exists")
    return errors
