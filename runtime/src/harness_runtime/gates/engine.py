"""Gate Engine — deterministic evaluation of quality gates.

Architecture §5.4: 确定性检查 — artifact 存在/普通文件/非空/路径安全。
Architecture §5.4: WAIVED 必须 scope/reason/owner。
Architecture §5.4: FAIL → retry_count +=1; >2 → BLOCKED; 按 gate_to_node 回退。
"""

import json
from pathlib import Path
from typing import Any, Optional

from .permissions import check_gate_permission

VALID_GATE_STATUSES = {"PASS", "FAIL", "WAIVED", "BLOCKED", "NOT_REQUIRED", "NOT_RUN"}


def evaluate_gate(
    gate_id: str,
    state: dict,
    phase_dir: Path,
    caller_role: str = "developer",
    gate_meanings: Optional[dict[str, str]] = None,
    failure_recovery: Optional[dict[str, Any]] = None,
) -> dict:
    """Deterministic evaluation of a quality gate.

    Returns {"status": PASS|FAIL|WAIVED|BLOCKED|NOT_REQUIRED, "reason": str, "retry_target": node_id|None}.
    """
    current_status = state.get("gates", {}).get(gate_id, "NOT_RUN")

    # NOT_REQUIRED stays as-is — exit immediately, no permission needed
    if current_status == "NOT_REQUIRED":
        return {"status": "NOT_REQUIRED", "reason": "Gate marked as not required", "retry_target": None}

    # Permission check (after NOT_REQUIRED)
    perm_error = check_gate_permission(gate_id, caller_role)
    if perm_error:
        return {"status": "FAIL", "reason": perm_error, "retry_target": None}

    # WAIVED validation — check waiver metadata first
    if current_status == "WAIVED":
        return _validate_waiver(state, gate_id)

    # Deterministic artifact checks (for NOT_RUN and other statuses)
    gate_artifacts = _get_gate_artifacts(gate_id, gate_meanings)
    for artifact_name in gate_artifacts:
        check = _check_artifact(phase_dir, artifact_name)
        if check["status"] == "FAIL":
            return _handle_failure(state, gate_id, check["reason"], failure_recovery)

    return {"status": "PASS", "reason": "All deterministic checks passed", "retry_target": None}


def _check_artifact(phase_dir: Path, artifact_name: str) -> dict:
    """Deterministic artifact check — exists, is file, non-empty, in-bounds."""
    art_path = phase_dir / artifact_name
    if not art_path.is_file():
        return {"status": "FAIL", "reason": f"Required artifact missing: {artifact_name}"}
    if art_path.stat().st_size == 0:
        return {"status": "FAIL", "reason": f"Required artifact is empty: {artifact_name}"}
    # Path containment
    try:
        art_path.resolve().relative_to(phase_dir.resolve())
    except ValueError:
        return {"status": "FAIL", "reason": f"Artifact path escapes phase_dir: {artifact_name}"}
    return {"status": "PASS", "reason": "OK"}


def _validate_waiver(state: dict, gate_id: str) -> dict:
    """Validate that a WAIVED gate has proper metadata."""
    waivers = state.get("waivers", {})
    if gate_id not in waivers:
        return {"status": "FAIL", "reason": f"WAIVED gate {gate_id} missing waiver metadata"}
    w = waivers[gate_id]
    for field in ["scope", "reason", "owner"]:
        if field not in w:
            return {"status": "FAIL", "reason": f"WAIVED gate {gate_id} missing '{field}' field"}
    return {"status": "WAIVED", "reason": "Waiver validated", "retry_target": None}


def _handle_failure(
    state: dict,
    gate_id: str,
    reason: str,
    failure_recovery: Optional[dict[str, Any]],
) -> dict:
    """Handle a gate failure: increment retry_count, check limit, return retry target."""
    retry_counts = state.setdefault("retry_counts", {})
    count = retry_counts.get(gate_id, 0) + 1
    retry_counts[gate_id] = count
    max_retries = 2

    if count > max_retries:
        state["gates"][gate_id] = "BLOCKED"
        state.setdefault("blocked_by", []).append(f"{gate_id}_retry_exhausted")
        return {"status": "BLOCKED", "reason": f"Gate {gate_id} failed {count} times (max {max_retries})", "retry_target": None}

    # Map gate to retry node
    recovery = failure_recovery or {}
    gate_to_node = recovery.get("gate_to_node", {})
    retry_target = gate_to_node.get(gate_id)

    return {
        "status": "FAIL",
        "reason": f"Gate {gate_id} failed (attempt {count}/{max_retries}): {reason}",
        "retry_target": retry_target,
    }


def _get_gate_artifacts(gate_id: str, gate_meanings: Optional[dict[str, str]]) -> list[str]:
    """Get the required artifacts for a gate (from gates.yaml)."""
    # Standard mapping from architecture §5.4 + gates.yaml
    standard_artifacts = {
        "G1_REQUIREMENTS": ["01-requirement-review.md"],
        "G2_DESIGN": ["03-solution-design.md", "06-implementation-plan.md"],
        "G3_COMPILE": ["12-compile.md"],
        "G4_UNIT_TEST": ["13-unit-test.md"],
        "G5_ATDD": ["14-atdd.md"],
        "G6_EVIDENCE": ["15-evidence.json"],
        "G7_PRERELEASE": ["16-prerelease-deployment.md", "17-interface-test.md"],
        "G8_ACCEPTANCE": ["18-acceptance-report.md"],
    }
    return standard_artifacts.get(gate_id, [])
