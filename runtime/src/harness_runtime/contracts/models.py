"""Pydantic models for the Harness Desktop RPC contract.

These models must stay in sync with schemas/rpc.schema.json and
packages/contracts/src/rpc.ts. Both are validated against the same
example payloads in their respective test suites (architecture 5.2).
"""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CommandMeta(BaseModel):
    """Metadata attached to every RPC command (architecture 11)."""

    request_id: str = Field(alias="requestId")
    project_id: str = Field(alias="projectId")
    run_id: Optional[str] = Field(default=None, alias="runId")
    expected_revision: Optional[str] = Field(default=None, alias="expectedRevision")


class RpcRequest(BaseModel):
    """JSON-RPC 2.0 request with harness command metadata."""

    jsonrpc: Literal["2.0"] = "2.0"
    method: str
    params: Optional[dict[str, Any]] = None
    id: str
    meta: CommandMeta


class RpcError(BaseModel):
    """Structured RPC error with optional JSON Pointer (RFC 6901)."""

    code: str
    message: str
    pointer: Optional[str] = None


class RpcResponse(BaseModel):
    """JSON-RPC 2.0 response."""

    jsonrpc: Literal["2.0"] = "2.0"
    result: Optional[Any] = None
    error: Optional[RpcError] = None
    id: str


RuntimeEventType = Literal[
    "StateChanged",
    "WorkflowChanged",
    "ExecutionOutput",
    "ToolCall",
    "ApprovalRequested",
    "GateEvaluated",
    "ArtifactChanged",
    "ExecutorExited",
    "RuntimeWarning",
]


class RuntimeEvent(BaseModel):
    """Runtime event pushed over WebSocket (architecture 11)."""

    type: RuntimeEventType
    payload: Optional[dict[str, Any]] = None
    timestamp: str


class ProjectSummary(BaseModel):
    """Project summary returned by project.list."""

    project_id: str = Field(alias="projectId")
    name: str
    protocol_version: str = Field(alias="protocolVersion")
    health: Literal["healthy", "degraded", "readonly"]
    active_run_id: Optional[str] = Field(default=None, alias="activeRunId")


class RunStateDto(BaseModel):
    """DTO for current run state."""

    run_id: str = Field(alias="runId")
    intent: str
    risk: str
    status: str
    current_node: str = Field(alias="currentNode")
    completed_nodes: list[str] = Field(default_factory=list, alias="completedNodes")
    required_nodes: list[str] = Field(default_factory=list, alias="requiredNodes")


class WorkflowDiagnostic(BaseModel):
    """Diagnostic from workflow compilation."""

    code: str
    severity: Literal["error", "warning"]
    pointer: str
    message: str
