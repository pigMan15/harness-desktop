"""Load .harness v1.0 files from disk.

Architecture §5.4: path resolution must reject symlink/junction escape.
Architecture §14: all paths canonicalized before validation.
"""

import json
from pathlib import Path
from typing import Any

import yaml

from .models import HarnessState, WorkflowDefinition


class ProtocolLoadError(Exception):
    """Raised when a .harness file cannot be loaded or parsed."""

    def __init__(self, code: str, message: str, pointer: str = "/"):
        self.code = code
        self.message = message
        self.pointer = pointer
        super().__init__(f"[{code}] {message} (pointer: {pointer})")


def _resolve_safe(base: Path, relative: str) -> Path:
    """Resolve a path safely, rejecting escapes outside the base directory."""
    resolved = (base / relative).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise ProtocolLoadError(
            "PATH_ESCAPE",
            f"Path {relative!r} resolves to {resolved}, which escapes base {base}",
            pointer=f"/{relative}",
        )
    # Reject symlinks and junctions (architecture §14)
    if resolved.is_symlink():
        raise ProtocolLoadError(
            "SYMLINK_REJECTED",
            f"Symlinks are not allowed: {resolved}",
            pointer=f"/{relative}",
        )
    return resolved


def load_state(project_root: Path) -> HarnessState:
    """Load and validate .harness/state.json from a project root.

    Returns a validated HarnessState model.
    Raises ProtocolLoadError on any load/parse/validation failure.
    """
    state_path = project_root / ".harness" / "state.json"
    try:
        resolved = _resolve_safe(project_root, ".harness/state.json")
    except ProtocolLoadError:
        raise
    if not resolved.is_file():
        raise ProtocolLoadError("STATE_MISSING", f"state.json not found at {state_path}")
    try:
        with open(resolved, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ProtocolLoadError("STATE_INVALID_JSON", str(e), pointer="/")
    except UnicodeDecodeError as e:
        raise ProtocolLoadError("STATE_ENCODING", str(e), pointer="/")
    try:
        return HarnessState(**data)
    except Exception as e:
        raise ProtocolLoadError("STATE_VALIDATION_FAILED", str(e), pointer="/")


def load_workflow(project_root: Path) -> WorkflowDefinition:
    """Load and validate .harness/workflow.yaml from a project root.

    Returns a validated WorkflowDefinition model.
    Raises ProtocolLoadError on any load/parse/validation failure.
    """
    wf_path = project_root / ".harness" / "workflow.yaml"
    try:
        resolved = _resolve_safe(project_root, ".harness/workflow.yaml")
    except ProtocolLoadError:
        raise
    if not resolved.is_file():
        raise ProtocolLoadError("WORKFLOW_MISSING", f"workflow.yaml not found at {wf_path}")
    try:
        with open(resolved, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        raise ProtocolLoadError("WORKFLOW_INVALID_YAML", str(e), pointer="/")
    if not isinstance(data, dict):
        raise ProtocolLoadError("WORKFLOW_TYPE", "workflow.yaml must be a YAML mapping", pointer="/")
    try:
        return WorkflowDefinition(**data)
    except Exception as e:
        raise ProtocolLoadError("WORKFLOW_VALIDATION_FAILED", str(e), pointer="/")


def load_gate_config(project_root: Path) -> dict[str, Any]:
    """Load the project's gate definitions without hardcoding standard IDs."""
    path = _resolve_safe(project_root, ".harness/evals/gates.yaml")
    if not path.is_file():
        raise ProtocolLoadError("GATES_MISSING", f"gates.yaml not found at {path}")
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        raise ProtocolLoadError("GATES_INVALID_YAML", str(exc), pointer="/") from exc
    gates = data.get("gates")
    if not isinstance(gates, dict):
        raise ProtocolLoadError("GATES_TYPE", "gates must be a mapping", pointer="/gates")
    normalized: dict[str, Any] = {}
    for gate_id, definition in gates.items():
        if not isinstance(gate_id, str) or not isinstance(definition, dict):
            raise ProtocolLoadError(
                "GATE_DEFINITION_INVALID", "gate definitions must be mappings", pointer="/gates"
            )
        artifacts = definition.get("required_artifacts", [])
        if not isinstance(artifacts, list) or not all(isinstance(item, str) for item in artifacts):
            raise ProtocolLoadError(
                "GATE_ARTIFACTS_INVALID",
                f"required_artifacts for {gate_id} must be a string list",
                pointer=f"/gates/{gate_id}/required_artifacts",
            )
        normalized[gate_id] = {**definition, "required_artifacts": artifacts}
    return {**data, "gates": normalized}


def load_project(project_root: Path, deep_validate: bool = True) -> dict[str, Any]:
    """Load a complete .harness v1.0 project.

    Returns {"state": HarnessState, "workflow": WorkflowDefinition, "diagnostics": [...]}.
    When deep_validate=True, also runs semantic validation (validator.py) and raises
    ProtocolLoadError if any error-level diagnostics are found.
    """
    from .validator import validate_state_deep, validate_workflow_deep

    state = load_state(project_root)
    workflow = load_workflow(project_root)
    diagnostics: list = []

    if deep_validate:
        harness_dir = project_root / ".harness"
        # 证据属于当前 Run 的 phase_dir，不能固定从 phases 根目录读取。
        phase_dir = project_root / state.phase_dir
        agents_dir = harness_dir / "agents"

        diagnostics.extend(validate_state_deep(state, phase_dir, harness_dir / "phases"))
        diagnostics.extend(validate_workflow_deep(workflow, agents_dir=agents_dir if agents_dir.is_dir() else None))

        errors = [d for d in diagnostics if d.severity == "error"]
        if errors:
            first = errors[0]
            raise ProtocolLoadError(first.code, first.message, pointer=first.pointer)

    return {"state": state, "workflow": workflow, "diagnostics": [d.to_dict() for d in diagnostics]}
