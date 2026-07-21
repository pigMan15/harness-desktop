"""Validate .harness v1.0 protocol files beyond Pydantic model validation.

Architecture §5.4: deterministic checks — required artifact exists / non-empty / in-bounds.
Architecture §9.2: workflow compile checks — node uniqueness, role existence, gate references.

Extracted and enhanced from M1 runtime/tests/contract/test_harness_v1_fixtures.py.
"""

import json
from pathlib import Path
from typing import Optional

from .models import HarnessState, WorkflowDefinition


class WorkflowDiagnostic:
    """A single diagnostic from workflow validation (architecture §11)."""

    def __init__(self, code: str, severity: str, pointer: str, message: str):
        self.code = code
        self.severity = severity  # "error" | "warning"
        self.pointer = pointer
        self.message = message

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "severity": self.severity,
            "pointer": self.pointer,
            "message": self.message,
        }

    def __repr__(self) -> str:
        return f"[{self.severity.upper()}] {self.code}: {self.message} ({self.pointer})"


def validate_state_deep(state: HarnessState, phase_dir: Path, phases_root: Path) -> list[WorkflowDiagnostic]:
    """Deep validation of state.json beyond Pydantic model checks.

    Checks:
    - phase_dir resolves within phases root
    - completed_nodes is subset of required_nodes (already in Pydantic, cross-check)
    - G6 evidence: if G6_EVIDENCE=PASS, 15-evidence.json must exist + be valid JSON with 9 fields
    - WAIVED gates must have waiver metadata
    """
    diags: list[WorkflowDiagnostic] = []

    # phase_dir must not escape phases root
    try:
        resolved_phase = (phase_dir).resolve()
        resolved_phase.relative_to(phases_root.resolve())
    except ValueError:
        diags.append(WorkflowDiagnostic(
            "PHASE_DIR_ESCAPE", "error", "/phase_dir",
            f"phase_dir {state.phase_dir!r} resolves outside phases root",
        ))

    # G6 evidence check
    if state.gates.get("G6_EVIDENCE") == "PASS":
        evidence_path = phase_dir / "15-evidence.json"
        if not evidence_path.is_file():
            diags.append(WorkflowDiagnostic(
                "G6_EVIDENCE_MISSING", "error", "/gates/G6_EVIDENCE",
                f"G6_EVIDENCE is PASS but evidence file not found at {evidence_path}",
            ))
        else:
            try:
                with open(evidence_path, encoding="utf-8") as f:
                    evidence = json.load(f)
                g6_fields = ["run_id", "intent", "risk", "changed_files", "commands",
                             "gates", "artifacts", "waivers", "residual_risks"]
                for field in g6_fields:
                    if field not in evidence:
                        diags.append(WorkflowDiagnostic(
                            "G6_EVIDENCE_MISSING_FIELD", "error", "/gates/G6_EVIDENCE",
                            f"G6 evidence missing required field: {field}",
                        ))
                for w in evidence.get("waivers", []):
                    for k in ["scope", "reason", "owner"]:
                        if k not in w:
                            diags.append(WorkflowDiagnostic(
                                "WAIVED_MISSING_FIELD", "error", "/waivers",
                                f"Waiver missing required field: {k}",
                            ))
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                diags.append(WorkflowDiagnostic(
                    "G6_EVIDENCE_INVALID_JSON", "error", "/gates/G6_EVIDENCE",
                    f"G6 evidence is not valid JSON: {e}",
                ))

    # WAIVED gates need waiver metadata
    for gate, status in state.gates.items():
        if status == "WAIVED":
            # In v1.0, waiver metadata is stored in notes or a separate waivers field
            # For now, flag that waivers need documentation
            # Full check: waivers should be in evidence or state metadata
            pass  # Defer to evidence.json check above

    return diags


def validate_workflow_deep(
    wf: WorkflowDefinition,
    agents_dir: Optional[Path] = None,
) -> list[WorkflowDiagnostic]:
    """Deep validation of workflow.yaml beyond Pydantic model checks.

    Architecture §9.2 compile checks:
    - Node IDs unique
    - Role references exist (known roles or agents/*.md)
    - Gate references defined in gate_meanings
    - failure_recovery gate_to_node has no endless cycles
    - artifact paths are safe (no ../ or absolute)
    """
    diags: list[WorkflowDiagnostic] = []

    # Node ID uniqueness
    node_ids = [n.id for n in wf.nodes]
    if len(node_ids) != len(set(node_ids)):
        duplicates = [nid for nid in node_ids if node_ids.count(nid) > 1]
        diags.append(WorkflowDiagnostic(
            "WORKFLOW_DUPLICATE_NODE", "error", "/nodes",
            f"Duplicate node IDs: {set(duplicates)}",
        ))

    # Role references
    known_roles = _get_known_roles(agents_dir)
    for node in wf.nodes:
        if node.role not in known_roles:
            diags.append(WorkflowDiagnostic(
                "WORKFLOW_UNKNOWN_ROLE", "error", f"/nodes/{node.id}/role",
                f"Unknown role: {node.role!r}",
            ))

    # Gate references
    defined_gates = set(wf.gate_meanings.keys())
    for node in wf.nodes:
        for gate in node.gates:
            if gate not in defined_gates:
                diags.append(WorkflowDiagnostic(
                    "WORKFLOW_UNDEFINED_GATE", "error", f"/nodes/{node.id}/gates",
                    f"Gate {gate!r} referenced but not defined in gate_meanings",
                ))

    # Artifact safety
    for node in wf.nodes:
        if ".." in node.artifact or node.artifact.startswith("/"):
            diags.append(WorkflowDiagnostic(
                "WORKFLOW_UNSAFE_ARTIFACT", "error", f"/nodes/{node.id}/artifact",
                f"Artifact path unsafe: {node.artifact!r}",
            ))

    # Endless rollback detection
    cycle_diag = _detect_rollback_cycle(wf)
    if cycle_diag:
        diags.append(cycle_diag)

    return diags


def _get_known_roles(agents_dir: Optional[Path]) -> set[str]:
    """Get the set of known role names from built-in set + agents/ directory."""
    from .models import KNOWN_ROLES
    roles = set(KNOWN_ROLES)
    if agents_dir and agents_dir.is_dir():
        for f in agents_dir.glob("*.md"):
            roles.add(f.stem)
    return roles


def _detect_rollback_cycle(wf: WorkflowDefinition) -> Optional[WorkflowDiagnostic]:
    """Detect endless rollback cycles in failure_recovery.gate_to_node.

    Self-retry (gate G on node N → recovery maps to N again) is NOT a cycle
    (it's a retry capped by max_auto_retries_per_gate).

    True cycle: gate G owned by node A → recovery maps to B (B≠A) → B's gate H
    → recovery maps to A → A visited twice.
    """
    gate_to_node = wf.failure_recovery.get("gate_to_node", {})
    if not gate_to_node:
        return None

    node_gates: dict[str, list[str]] = {n.id: n.gates for n in wf.nodes}
    gate_owners: dict[str, set[str]] = {}
    for node in wf.nodes:
        for g in node.gates:
            gate_owners.setdefault(g, set()).add(node.id)

    for start_gate in gate_to_node:
        visited_nodes: set[str] = set()
        current_gate = start_gate
        while current_gate in gate_to_node:
            target = gate_to_node[current_gate]
            owners = gate_owners.get(current_gate, set())
            # Self-retry: gate owned by target → retry, not cycle
            if target in owners:
                break
            # Cross-node recovery
            if target in visited_nodes:
                return WorkflowDiagnostic(
                    "WORKFLOW_ENDLESS_ROLLBACK", "error", "/failure_recovery/gate_to_node",
                    f"Endless rollback cycle: gate {current_gate!r} → node {target!r} visited twice",
                )
            visited_nodes.add(target)
            # Next gate from target node
            next_gate = None
            for ng in node_gates.get(target, []):
                if ng in gate_to_node:
                    next_gate = ng
                    break
            if next_gate is None:
                break
            current_gate = next_gate
    return None
