"""Pydantic models for .harness v1.0 protocol files.

Architecture §5.1: State key constraints (run_id regex, Intent/Risk enum, phase_dir safety).
Architecture §5.2: 22 built-in nodes with roles/artifacts/gates.
"""

import re
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

# ── Constants ────────────────────────────────────────────

RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
VALID_INTENTS = {"UNKNOWN", "QUERY", "BUG_FIX", "FEATURE", "REFACTOR", "DEPLOYMENT", "INCIDENT"}
VALID_RISKS = {"UNKNOWN", "NA", "LOW", "MEDIUM", "HIGH"}
VALID_STATUSES = {
    "IDLE", "ROUTING", "IN_PROGRESS", "REVIEWING", "DESIGNING",
    "PLANNING", "DEVELOPING", "VERIFYING", "DEPLOYING", "TESTING",
    "REPORTING", "BLOCKED", "DONE",
}
VALID_GATE_STATUSES = {"PASS", "FAIL", "WAIVED", "BLOCKED", "NOT_REQUIRED", "NOT_RUN"}
KNOWN_ROLES = {
    "dispatcher", "requirement-analyst", "orchestrator", "tech-architect",
    "quality-guardian", "plan-generator", "state-keeper", "developer",
    "verifier", "deployer", "tester", "knowledge-keeper", "intent-classifier",
}


# ── State ────────────────────────────────────────────────


class HarnessState(BaseModel):
    """Complete .harness/state.json model (architecture §5.1)."""

    schema_version: str
    run_id: str
    status: str
    intent: str
    risk: str
    current_node: str
    next_role: str
    phase_dir: str
    required_nodes: list[str]
    completed_nodes: list[str]
    blocked_by: list[str] = []
    artifacts: dict[str, str] = {}
    gates: dict[str, str] = {}
    retry_counts: dict[str, int] = {}
    last_updated: Optional[str] = None
    notes: str = ""

    @field_validator("run_id")
    @classmethod
    def run_id_must_match_pattern(cls, v: str) -> str:
        if not RUN_ID_PATTERN.match(v):
            raise ValueError(f"run_id must match {RUN_ID_PATTERN.pattern}, got {v!r}")
        if ".." in v or "/" in v or "\\" in v:
            raise ValueError(f"run_id contains unsafe characters: {v!r}")
        return v

    @field_validator("intent")
    @classmethod
    def intent_must_be_valid(cls, v: str) -> str:
        if v not in VALID_INTENTS:
            raise ValueError(f"Unknown intent: {v!r}. Must be one of {VALID_INTENTS}")
        return v

    @field_validator("risk")
    @classmethod
    def risk_must_be_valid(cls, v: str) -> str:
        if v not in VALID_RISKS:
            raise ValueError(f"Unknown risk: {v!r}. Must be one of {VALID_RISKS}")
        return v

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"Unknown status: {v!r}")
        return v

    @field_validator("phase_dir")
    @classmethod
    def phase_dir_must_be_safe(cls, v: str) -> str:
        if ".." in v:
            raise ValueError(f"phase_dir contains path escape: {v!r}")
        return v

    @field_validator("completed_nodes")
    @classmethod
    def completed_must_be_subset_of_required(cls, v: list[str], info: Any) -> list[str]:
        required = info.data.get("required_nodes", [])
        if required:
            extra = set(v) - set(required)
            if extra:
                raise ValueError(f"completed_nodes contains nodes not in required_nodes: {extra}")
        return v

    @field_validator("required_nodes")
    @classmethod
    def required_nodes_must_be_unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("required_nodes contains duplicates")
        return v

    @field_validator("gates")
    @classmethod
    def gate_statuses_must_be_valid(cls, v: dict[str, str]) -> dict[str, str]:
        for gate, status in v.items():
            if status not in VALID_GATE_STATUSES:
                raise ValueError(f"Gate {gate!r} has invalid status: {status!r}")
        return v


# ── Workflow ─────────────────────────────────────────────


class NodeDefinition(BaseModel):
    """Single node in a workflow (architecture §5.2)."""

    id: str
    role: str
    artifact: str
    gates: list[str] = []


class WorkflowDefinition(BaseModel):
    """Complete .harness/workflow.yaml model."""

    schema_version: str
    artifact_root: str = "state.phase_dir"
    nodes: list[NodeDefinition]
    routes: dict[str, dict[str, list[str]]]
    hard_rules: dict[str, Any] = {}
    failure_recovery: dict[str, Any] = {}
    gate_meanings: dict[str, str] = {}
