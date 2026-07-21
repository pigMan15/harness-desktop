"""Run Service — creates, lists, switches, pauses, and resumes workflow runs.

Architecture §3.4: 活动 Run 路由冻结 — 修改 workflow.yaml 只影响新 Run。
Architecture §6.1: create_run 只接受用户提供的 Intent/Risk，不提供自动分类参数。
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..protocol.loader import load_workflow
from ..workflow.compiler import compile_workflow
from .identifiers import validate_run_id

VALID_INTENTS = {"UNKNOWN", "QUERY", "BUG_FIX", "FEATURE", "REFACTOR", "DEPLOYMENT", "INCIDENT"}
VALID_RISKS = {"UNKNOWN", "NA", "LOW", "MEDIUM", "HIGH"}


def create_run(
    project_root: Path,
    intent: str,
    risk: str,
    run_id: str,
    existing_runs: Optional[set[str]] = None,
) -> dict:
    """Create a new harness workflow run.

    Architecture §6.1: create_run 只接受用户提供的 Intent/Risk，不提供自动分类参数。
    Architecture §3.4: 编译后的路由写入 state.required_nodes，之后修改 workflow.yaml 只影响新 Run。

    Returns the initial state dict.
    Raises ValueError on invalid parameters.
    """
    # Validate intent/risk (user-specified only)
    if intent not in VALID_INTENTS:
        raise ValueError(f"Invalid intent: {intent!r}. Must be one of {VALID_INTENTS}")
    if risk not in VALID_RISKS:
        raise ValueError(f"Invalid risk: {risk!r}. Must be one of {VALID_RISKS}")

    # Validate run_id
    id_errors = validate_run_id(run_id, existing_runs)
    if id_errors:
        raise ValueError(f"Invalid run_id: {'; '.join(id_errors)}")

    # Compile the workflow to get required_nodes
    workflow = load_workflow(project_root)
    compiled = compile_workflow(workflow, intent, risk)

    phase_dir = f".harness/phases/{run_id}"

    state = {
        "schema_version": "1.0",
        "run_id": run_id,
        "status": "ROUTING",
        "intent": intent,
        "risk": risk,
        "current_node": compiled.required_nodes[0] if compiled.required_nodes else "INTAKE",
        "next_role": "dispatcher",
        "phase_dir": phase_dir,
        "required_nodes": compiled.required_nodes,
        "completed_nodes": [],
        "blocked_by": [],
        "artifacts": {},
        "gates": {
            "G1_REQUIREMENTS": "NOT_RUN",
            "G2_DESIGN": "NOT_RUN",
            "G3_COMPILE": "NOT_RUN",
            "G4_UNIT_TEST": "NOT_RUN",
            "G5_ATDD": "NOT_RUN",
            "G6_EVIDENCE": "NOT_RUN",
            "G7_PRERELEASE": "NOT_RUN",
            "G8_ACCEPTANCE": "NOT_RUN",
        },
        "retry_counts": {},
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "notes": f"Run created. Intent={intent}, Risk={risk}.",
    }
    return state


def list_runs(project_root: Path) -> list[dict]:
    """List all saved run snapshots."""
    runs_dir = project_root / ".harness" / "runs"
    if not runs_dir.is_dir():
        return []
    runs = []
    for d in sorted(runs_dir.iterdir(), reverse=True):
        if d.is_dir() and (d / "state.json").is_file():
            runs.append({"run_id": d.name, "phase_dir": f".harness/runs/{d.name}"})
    return runs


def switch_run(project_root: Path, run_id: str, target_state: dict) -> dict:
    """Switch to a previously saved run snapshot."""
    runs_dir = project_root / ".harness" / "runs"
    snapshot = runs_dir / run_id / "state.json"
    if not snapshot.is_file():
        raise ValueError(f"Run snapshot not found: {run_id}")
    import json
    with open(snapshot, encoding="utf-8") as f:
        return json.load(f)


def pause_run(state: dict) -> dict:
    """Pause a run (set status flag, does not skip nodes)."""
    state["status"] = "BLOCKED"
    state["blocked_by"].append("user_paused")
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = "Run paused by user."
    return state


def resume_run(state: dict) -> dict:
    """Resume a paused run."""
    state["status"] = "IN_PROGRESS"
    state["blocked_by"] = [b for b in state.get("blocked_by", []) if b != "user_paused"]
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state["notes"] = "Run resumed by user."
    return state
