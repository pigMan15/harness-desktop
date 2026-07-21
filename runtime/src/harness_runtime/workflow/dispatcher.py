"""Dispatcher — selects the next required node and manages confirmations.

Architecture §6.3: Dispatcher 只返回 required_nodes 中第一个未完成节点。
Architecture §6.3: 未满足人工确认时不得完成 confirmation node。
Architecture §6.2: CHANGE_REQUEST 迁移活动 Run 时必须展示 route diff。
"""

from datetime import datetime, timezone
from typing import Optional


def next_node(state: dict) -> Optional[str]:
    """Return the first required node that is not yet completed.

    Architecture §6.3: Dispatcher 只返回 required_nodes 中第一个未完成节点。
    """
    required = state.get("required_nodes", [])
    completed = set(state.get("completed_nodes", []))
    for node in required:
        if node not in completed:
            return node
    return None  # All nodes completed


def confirm_node(
    state: dict,
    node_id: str,
    decision: str,
    comment: str = "",
    confirmed_by: str = "user",
) -> dict:
    """Record a human confirmation decision.

    Architecture §6.3: 记录确认人、决定、意见和时间到 phase artifact。
    Confirmation nodes (REQUIREMENT_CONFIRMATION, SOLUTION_CONFIRMATION,
    ACCEPTANCE_CONFIRMATION, CODING_DESIGN_CONFIRMATION) require this.

    Raises ValueError if decision is invalid.
    """
    valid_decisions = {"accepted", "rejected", "deferred"}
    if decision not in valid_decisions:
        raise ValueError(f"Invalid decision: {decision!r}. Must be one of {valid_decisions}")

    state.setdefault("confirmations", {})
    state["confirmations"][node_id] = {
        "decision": decision,
        "comment": comment,
        "confirmed_by": confirmed_by,
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
    }

    if decision == "accepted":
        state["notes"] = f"Node {node_id} confirmed by {confirmed_by}."
    elif decision == "rejected":
        state["notes"] = f"Node {node_id} rejected by {confirmed_by}: {comment}"
        state.setdefault("blocked_by", []).append(f"rejected_{node_id}")

    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    return state


def change_request(
    state: dict,
    new_required_nodes: list[str],
    reason: str = "",
) -> dict:
    """Handle a CHANGE_REQUEST for migrating an active run's route.

    Architecture §6.2: 展示 route diff 并保留已完成节点一致性。
    """
    old_route = state.get("required_nodes", [])
    new_route = list(new_required_nodes)

    # Compute diff
    added = [n for n in new_route if n not in old_route]
    removed = [n for n in old_route if n not in new_route]
    kept = [n for n in old_route if n in new_route]

    # Preserve completed nodes that are still in the new route
    completed = state.get("completed_nodes", [])
    new_completed = [n for n in completed if n in new_route]

    diff = {
        "old_route": old_route,
        "new_route": new_route,
        "added": added,
        "removed": removed,
        "kept": kept,
        "reason": reason,
    }

    state["required_nodes"] = new_route
    state["completed_nodes"] = new_completed
    state.setdefault("route_changes", []).append(diff)
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = f"CHANGE_REQUEST applied: +{len(added)} nodes, -{len(removed)} nodes. {reason}"

    return state
