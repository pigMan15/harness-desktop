"""Authoritative node completion and confirmation operations."""

from pathlib import Path
from typing import Optional

from ..persistence.state_store import read_run_state, write_run_state
from ..protocol.loader import load_workflow
from ..workflow.dispatcher import confirm_node, next_node

CONFIRMATION_NODES = {
    "REQUIREMENT_CONFIRMATION",
    "SOLUTION_CONFIRMATION",
    "ACCEPTANCE_CONFIRMATION",
    "CODING_DESIGN_CONFIRMATION",
}


def complete_node(
    project_root: Path,
    run_id: str,
    expected_revision: Optional[str] = None,
) -> dict:
    state, revision = _read_checked(project_root, run_id, expected_revision)
    current = state.get("current_node", "")
    if current in CONFIRMATION_NODES:
        confirmation = state.get("confirmations", {}).get(current, {})
        if confirmation.get("decision") != "accepted":
            raise ValueError(f"CONFIRMATION_REQUIRED: {current}")
    workflow = load_workflow(project_root)
    _complete_in_memory(project_root, state, workflow)
    new_revision = write_run_state(
        project_root, run_id, state, expected_revision=revision
    )
    return {"run": state, "revision": new_revision}


def decide_node(
    project_root: Path,
    run_id: str,
    decision: str,
    comment: str = "",
    confirmed_by: str = "user",
    expected_revision: Optional[str] = None,
) -> dict:
    state, revision = _read_checked(project_root, run_id, expected_revision)
    current = state.get("current_node", "")
    if current not in CONFIRMATION_NODES:
        raise ValueError(f"NODE_NOT_CONFIRMATION: {current}")
    normalized = {
        "accept": "accepted",
        "accepted": "accepted",
        "reject": "rejected",
        "rejected": "rejected",
        "defer": "deferred",
        "deferred": "deferred",
    }.get(decision)
    if not normalized:
        raise ValueError(f"CONFIRMATION_DECISION_INVALID: {decision}")

    # 决策身份、时间和意见由 Runtime 统一记录，Renderer 不能直接拼装 confirmation 状态。
    confirm_node(state, current, normalized, comment, confirmed_by)
    if normalized == "accepted":
        _complete_in_memory(project_root, state, load_workflow(project_root))
    elif normalized == "rejected":
        state["status"] = "BLOCKED"
    else:
        state["status"] = "REVIEWING"
    new_revision = write_run_state(
        project_root, run_id, state, expected_revision=revision
    )
    return {"run": state, "revision": new_revision}


def reject_node(
    project_root: Path,
    run_id: str,
    comment: str,
    confirmed_by: str = "user",
    expected_revision: Optional[str] = None,
) -> dict:
    return decide_node(
        project_root,
        run_id,
        "reject",
        comment,
        confirmed_by,
        expected_revision,
    )


def _read_checked(
    project_root: Path, run_id: str, expected_revision: Optional[str]
) -> tuple[dict, str]:
    state, revision = read_run_state(project_root, run_id)
    if not state:
        raise ValueError(f"RUN_NOT_FOUND: {run_id}")
    if expected_revision is not None and expected_revision != revision:
        raise RuntimeError("REVISION_CONFLICT")
    return state, revision


def _complete_in_memory(project_root: Path, state: dict, workflow) -> None:
    current = state.get("current_node", "")
    if current not in state.get("required_nodes", []):
        raise ValueError(f"NODE_NOT_REQUIRED: {current}")
    if current in state.get("completed_nodes", []):
        raise ValueError(f"NODE_ALREADY_COMPLETED: {current}")
    definition = next((node for node in workflow.nodes if node.id == current), None)
    if definition is None:
        raise ValueError(f"NODE_DEFINITION_MISSING: {current}")
    artifact = _validate_artifact(project_root, state, definition.artifact)
    state.setdefault("artifacts", {})[current] = artifact
    state.setdefault("completed_nodes", []).append(current)
    following = next_node(state)
    if following is None:
        state["status"] = "DONE"
        state["current_node"] = current
        state["next_role"] = definition.role
        state["notes"] = "All required nodes completed."
        return
    next_definition = next((node for node in workflow.nodes if node.id == following), None)
    if next_definition is None:
        raise ValueError(f"NODE_DEFINITION_MISSING: {following}")
    state["current_node"] = following
    state["next_role"] = next_definition.role
    state["status"] = "IN_PROGRESS"
    state["notes"] = f"Node {current} completed; routed to {following}."


def _validate_artifact(project_root: Path, state: dict, filename: str) -> str:
    relative = Path(filename)
    if relative.is_absolute() or ".." in relative.parts or len(relative.parts) != 1:
        raise ValueError(f"ARTIFACT_PATH_INVALID: {filename}")
    phase_dir = (project_root / state.get("phase_dir", "")).resolve()
    try:
        phase_dir.relative_to(project_root.resolve())
    except ValueError as exc:
        raise ValueError("PHASE_DIR_ESCAPE") from exc
    artifact = (phase_dir / relative).resolve()
    try:
        artifact.relative_to(phase_dir)
    except ValueError as exc:
        raise ValueError(f"ARTIFACT_ESCAPE: {filename}") from exc
    if artifact.is_symlink() or not artifact.is_file():
        raise ValueError(f"ARTIFACT_MISSING: {filename}")
    if artifact.stat().st_size == 0:
        raise ValueError(f"ARTIFACT_EMPTY: {filename}")
    return filename
