"""Contract tests for .harness v1.0 compatibility fixtures.

Each fixture is a directory under fixtures/harness-v1/ containing a .harness/ subtree.
Valid fixtures must pass validation; invalid fixtures must return a stable error code
and a JSON Pointer to the violating field (architecture 5.4).
"""

import json
import os
from pathlib import Path
from typing import Optional

import pytest

FIXTURES_ROOT = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"
VALID_FIXTURE = FIXTURES_ROOT / "valid-project"


def load_state(harness_dir: Path) -> dict:
    """Load and parse state.json from a .harness directory."""
    state_path = harness_dir / "state.json"
    with open(state_path, encoding="utf-8") as f:
        return json.load(f)


def load_workflow(harness_dir: Path) -> dict:
    """Load and shallow-parse workflow.yaml (YAML as string, return structure)."""
    import yaml  # optional; fall back to plain text check
    wf_path = harness_dir / "workflow.yaml"
    with open(wf_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def validate_fixture(harness_dir: Path) -> Optional[dict]:
    """Validate a .harness v1.0 fixture directory.

    Returns None if valid, or an error dict with code and pointer on failure.
    """
    state_path = harness_dir / "state.json"

    # 1. state.json must exist and be parseable JSON
    if not state_path.is_file():
        return {"code": "STATE_MISSING", "pointer": "/", "message": "state.json not found"}
    try:
        state = load_state(harness_dir)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return {"code": "STATE_INVALID_JSON", "pointer": "/", "message": str(e)}

    # 2. Required state fields
    for field in ["schema_version", "run_id", "status", "intent", "risk",
                  "current_node", "next_role", "phase_dir", "required_nodes",
                  "completed_nodes", "artifacts", "gates"]:
        if field not in state:
            return {"code": "STATE_MISSING_FIELD", "pointer": f"/{field}", "message": f"required field '{field}' missing"}

    # 3. run_id must be safe (no path traversal)
    run_id = state["run_id"]
    if ".." in run_id or "/" in run_id or "\\" in run_id:
        return {"code": "RUN_ID_UNSAFE", "pointer": "/run_id", "message": f"run_id contains path traversal: {run_id!r}"}
    import re
    if not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$", run_id):
        return {"code": "RUN_ID_INVALID", "pointer": "/run_id", "message": f"run_id does not match pattern: {run_id!r}"}

    # 4. intent must be valid enum
    valid_intents = {"UNKNOWN", "QUERY", "BUG_FIX", "FEATURE", "REFACTOR", "DEPLOYMENT", "INCIDENT"}
    if state["intent"] not in valid_intents:
        return {"code": "INTENT_INVALID", "pointer": "/intent", "message": f"unknown intent: {state['intent']!r}"}

    # 5. risk must be valid enum
    valid_risks = {"UNKNOWN", "NA", "LOW", "MEDIUM", "HIGH"}
    if state["risk"] not in valid_risks:
        return {"code": "RISK_INVALID", "pointer": "/risk", "message": f"unknown risk: {state['risk']!r}"}

    # 6. phase_dir must not escape phases root
    phase_dir = state["phase_dir"]
    if ".." in phase_dir:
        return {"code": "PHASE_DIR_ESCAPE", "pointer": "/phase_dir", "message": f"phase_dir contains path escape: {phase_dir!r}"}
    resolved = (harness_dir.parent / phase_dir).resolve()
    phases_root = (harness_dir.parent / ".harness" / "phases").resolve()
    try:
        resolved.relative_to(phases_root)
    except ValueError:
        return {"code": "PHASE_DIR_ESCAPE", "pointer": "/phase_dir", "message": f"phase_dir escapes phases root: resolved to {resolved}"}

    # 7. required_nodes must be a list of unique strings
    if not isinstance(state.get("required_nodes"), list):
        return {"code": "REQUIRED_NODES_TYPE", "pointer": "/required_nodes", "message": "required_nodes must be an array"}
    if len(state["required_nodes"]) != len(set(state["required_nodes"])):
        return {"code": "REQUIRED_NODES_DUPLICATE", "pointer": "/required_nodes", "message": "required_nodes contains duplicates"}

    # 8. completed_nodes must be subset of required_nodes
    completed = set(state.get("completed_nodes", []))
    required = set(state["required_nodes"])
    if not completed.issubset(required):
        return {"code": "COMPLETED_NOT_SUBSET", "pointer": "/completed_nodes", "message": "completed_nodes not subset of required_nodes"}

    # 9. gates must use valid status values
    valid_gate_status = {"PASS", "FAIL", "WAIVED", "BLOCKED", "NOT_REQUIRED", "NOT_RUN"}
    for gate, status in state.get("gates", {}).items():
        if status not in valid_gate_status:
            return {"code": "GATE_STATUS_INVALID", "pointer": f"/gates/{gate}", "message": f"invalid gate status: {status!r}"}

    # 10. WAIVED gates must have waiver metadata (if marked WAIVED)
    for gate, status in state.get("gates", {}).items():
        if status == "WAIVED":
            waivers = state.get("waivers", {})
            if gate not in waivers:
                return {"code": "WAIVED_NO_METADATA", "pointer": f"/gates/{gate}", "message": f"gate {gate} is WAIVED but no waiver metadata found"}
            w = waivers[gate]
            for f in ["scope", "reason", "owner"]:
                if f not in w:
                    return {"code": "WAIVED_MISSING_FIELD", "pointer": f"/waivers/{gate}/{f}", "message": f"WAIVED gate {gate} missing '{f}'"}

    # 11. G6 evidence check: if G6 is PASS, 15-evidence.json must exist and be valid JSON
    if state.get("gates", {}).get("G6_EVIDENCE") == "PASS":
        evidence_path = harness_dir.parent / phase_dir / "15-evidence.json"
        if not evidence_path.is_file():
            return {"code": "G6_EVIDENCE_MISSING", "pointer": "/gates/G6_EVIDENCE",
                    "message": f"G6_EVIDENCE is PASS but evidence file not found at {evidence_path}"}
        try:
            with open(evidence_path, encoding="utf-8") as f:
                evidence = json.load(f)
            for field in ["run_id", "intent", "risk", "changed_files", "commands", "gates", "artifacts", "waivers", "residual_risks"]:
                if field not in evidence:
                    return {"code": "G6_EVIDENCE_MISSING_FIELD", "pointer": f"/gates/G6_EVIDENCE",
                            "message": f"G6 evidence missing required field: {field}"}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {"code": "G6_EVIDENCE_INVALID_JSON", "pointer": "/gates/G6_EVIDENCE",
                    "message": "G6 evidence is not valid JSON"}

    # 12. workflow.yaml must exist
    wf_path = harness_dir / "workflow.yaml"
    if not wf_path.is_file():
        return {"code": "WORKFLOW_MISSING", "pointer": "/", "message": "workflow.yaml not found"}

    # 13. workflow must have nodes and routes
    try:
        wf = load_workflow(harness_dir)
    except Exception as e:
        return {"code": "WORKFLOW_INVALID_YAML", "pointer": "/", "message": str(e)}

    if not isinstance(wf, dict):
        return {"code": "WORKFLOW_TYPE", "pointer": "/", "message": "workflow.yaml must be a mapping"}

    if "nodes" not in wf:
        return {"code": "WORKFLOW_MISSING_NODES", "pointer": "/nodes", "message": "workflow.yaml missing 'nodes'"}
    if "routes" not in wf:
        return {"code": "WORKFLOW_MISSING_ROUTES", "pointer": "/routes", "message": "workflow.yaml missing 'routes'"}

    # 14. nodes must have unique ids
    node_ids = [n.get("id") for n in wf["nodes"] if isinstance(n, dict)]
    if len(node_ids) != len(set(node_ids)):
        return {"code": "WORKFLOW_DUPLICATE_NODE", "pointer": "/nodes", "message": "workflow nodes contain duplicate ids"}

    # 15. node roles must reference known roles (from agents/ or built-in set)
    known_roles = {"dispatcher", "requirement-analyst", "orchestrator", "tech-architect",
                   "quality-guardian", "plan-generator", "state-keeper", "developer",
                   "verifier", "deployer", "tester", "knowledge-keeper", "intent-classifier"}
    # Also check if agents/ directory has role files
    agents_dir = harness_dir / "agents"
    if agents_dir.is_dir():
        for agent_file in agents_dir.glob("*.md"):
            known_roles.add(agent_file.stem)
    for node in wf.get("nodes", []):
        if isinstance(node, dict):
            role = node.get("role")
            if not isinstance(role, str):
                return {"code": "WORKFLOW_NODE_ROLE_TYPE", "pointer": f"/nodes/{node.get('id', '?')}", "message": f"node role must be a string, got {type(role).__name__}"}
            if role not in known_roles:
                return {"code": "WORKFLOW_UNKNOWN_ROLE", "pointer": f"/nodes/{node.get('id', '?')}/role", "message": f"unknown role: {role!r}"}

    # 16. gate references in nodes must be defined in gate_meanings
    defined_gates = set(wf.get("gate_meanings", {}).keys())
    for node in wf.get("nodes", []):
        if isinstance(node, dict):
            for gate in node.get("gates", []):
                if gate not in defined_gates:
                    return {"code": "WORKFLOW_UNDEFINED_GATE", "pointer": f"/nodes/{node.get('id', '?')}/gates",
                            "message": f"gate '{gate}' referenced but not defined in gate_meanings"}

    # 17. failure_recovery gate_to_node must not create infinite loops
    # Build node->gates mapping for cycle detection
    node_gates = {}
    for node in wf.get("nodes", []):
        if isinstance(node, dict):
            node_gates[node.get("id")] = node.get("gates", [])
    recovery = wf.get("failure_recovery", {})
    gate_to_node = recovery.get("gate_to_node", {})

    # Find which node(s) own each gate
    gate_owners = {}  # gate → set of node ids
    for node in wf.get("nodes", []):
        if isinstance(node, dict):
            for g in node.get("gates", []):
                gate_owners.setdefault(g, set()).add(node.get("id"))

    # Detect endless rollback cycle.
    # Self-retry: gate G owned by N, recovery maps G→N → just a retry (not a cycle).
    # True cycle: gate G owned by A, recovery G→B (B≠A), B's gate H has recovery H→A → A visited twice.
    def detect_cycle() -> Optional[dict]:
        for start_gate in gate_to_node:
            visited_nodes = set()
            current_gate = start_gate
            while current_gate in gate_to_node:
                target = gate_to_node[current_gate]
                owners = gate_owners.get(current_gate, set())
                # Self-retry: this gate is the target's own gate → retry, not a cycle
                if target in owners:
                    return None  # self-retry, no cycle here
                # Cross-node recovery: we're going to a DIFFERENT node
                if target in visited_nodes:
                    return {"code": "WORKFLOW_ENDLESS_ROLLBACK", "pointer": "/failure_recovery/gate_to_node",
                            "message": f"endless rollback cycle: gate {current_gate!r} (owned by {owners}) → node {target!r} visited twice"}
                visited_nodes.add(target)
                # Find next gate from this target node
                next_gate = None
                for ng in node_gates.get(target, []):
                    if ng in gate_to_node:
                        next_gate = ng
                        break
                if next_gate is None:
                    return None  # dead end — not a cycle
                current_gate = next_gate
        return None

    cycle_result = detect_cycle()
    if cycle_result:
        return cycle_result

    return None


# ── Parameterized fixture tests ──────────────────────────────

def discover_fixtures():
    """Discover valid and invalid fixture directories."""
    cases = []
    for entry in sorted(FIXTURES_ROOT.iterdir()):
        if not entry.is_dir():
            continue
        harness = entry / ".harness"
        if not harness.is_dir():
            continue
        is_valid = entry.name == "valid-project"
        cases.append(pytest.param(entry, is_valid, id=entry.name))
    return cases


@pytest.mark.parametrize("fixture_dir,is_valid", discover_fixtures())
def test_fixture_validation(fixture_dir: Path, is_valid: bool):
    """Valid fixtures must pass validation; invalid fixtures must return a stable error code and JSON Pointer."""
    harness = fixture_dir / ".harness"
    result = validate_fixture(harness)

    if is_valid:
        assert result is None, (
            f"Valid fixture {fixture_dir.name} failed validation:\n"
            f"  code={result['code']} pointer={result['pointer']} message={result['message']}"
        )
    else:
        assert result is not None, (
            f"Invalid fixture {fixture_dir.name} passed validation unexpectedly"
        )
        # Must have a stable error code (UPPER_SNAKE_CASE) and a JSON Pointer (starts with /)
        assert result["code"].isupper() or "_" in result["code"], f"error code not UPPER_SNAKE_CASE: {result['code']!r}"
        assert result["pointer"].startswith("/"), f"pointer must start with /: {result['pointer']!r}"
        assert isinstance(result["message"], str) and len(result["message"]) > 0, "message must be non-empty"
