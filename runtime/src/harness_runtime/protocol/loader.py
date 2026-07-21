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
        phase_dir = harness_dir / "phases"
        agents_dir = harness_dir / "agents"

        diagnostics.extend(validate_state_deep(state, phase_dir, harness_dir / "phases"))
        diagnostics.extend(validate_workflow_deep(workflow, agents_dir=agents_dir if agents_dir.is_dir() else None))

        errors = [d for d in diagnostics if d.severity == "error"]
        if errors:
            first = errors[0]
            raise ProtocolLoadError(first.code, first.message, pointer=first.pointer)

    return {"state": state, "workflow": workflow, "diagnostics": [d.to_dict() for d in diagnostics]}
