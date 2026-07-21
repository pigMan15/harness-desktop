"""Gate permission checks — architecture §5.3: G3-G8 只能 verifier 标记。"""

VERIFIER_ONLY_GATES = {
    "G3_COMPILE", "G4_UNIT_TEST", "G5_ATDD",
    "G6_EVIDENCE", "G7_PRERELEASE", "G8_ACCEPTANCE",
}


def check_gate_permission(gate_id: str, caller_role: str) -> str | None:
    """Check if the caller has permission to mark a gate.

    Returns an error code string if permission denied, None if allowed.
    Architecture §5.3: G3-G8 只能由 verifier 权限域写入。
    """
    if gate_id in VERIFIER_ONLY_GATES and caller_role != "verifier":
        return "GATE_PERMISSION_DENIED"
    return None
