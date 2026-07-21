"""Contract tests for RPC schema validation.

Both the TypeScript types (packages/contracts/src/rpc.ts) and these
Pydantic models (runtime/.../contracts/models.py) must validate the
same example payloads from schemas/rpc.schema.json.
"""

import pytest
from pydantic import ValidationError

from harness_runtime.contracts.models import (
    CommandMeta,
    ProjectSummary,
    RpcError,
    RpcRequest,
    RpcResponse,
    RunStateDto,
    RuntimeEvent,
    WorkflowDiagnostic,
)


class TestCommandMeta:
    """CommandMeta requires requestId and projectId."""

    def test_valid_meta(self):
        meta = CommandMeta(requestId="req-001", projectId="test-project")
        assert meta.request_id == "req-001"
        assert meta.project_id == "test-project"

    def test_valid_with_optional(self):
        meta = CommandMeta(
            requestId="r1", projectId="p1", runId="run-1", expectedRevision="abc123"
        )
        assert meta.run_id == "run-1"
        assert meta.expected_revision == "abc123"

    def test_missing_request_id(self):
        with pytest.raises(ValidationError) as exc:
            CommandMeta(projectId="p1")
        assert "requestId" in str(exc.value)

    def test_missing_project_id(self):
        with pytest.raises(ValidationError) as exc:
            CommandMeta(requestId="r1")
        assert "projectId" in str(exc.value)


class TestRpcRequest:
    """RpcRequest validates request payloads."""

    def test_valid_health_request(self):
        req = RpcRequest(
            jsonrpc="2.0",
            method="runtime.health",
            id="req-001",
            meta={"requestId": "req-001", "projectId": "test-project"},
        )
        assert req.method == "runtime.health"
        assert req.meta.request_id == "req-001"

    def test_missing_id(self):
        with pytest.raises(ValidationError):
            RpcRequest(
                jsonrpc="2.0",
                method="runtime.health",
                meta={"requestId": "r1", "projectId": "p1"},
            )

    def test_no_params(self):
        req = RpcRequest(
            jsonrpc="2.0",
            method="runtime.health",
            id="req-002",
            meta={"requestId": "r2", "projectId": "p2"},
        )
        assert req.params is None


class TestRpcError:
    """RpcError must have code and message."""

    def test_auth_error(self):
        err = RpcError(code="AUTH_FAILED", message="Invalid token")
        assert err.code == "AUTH_FAILED"
        assert err.pointer is None

    def test_with_pointer(self):
        err = RpcError(code="STATE_INVALID", message="Bad state", pointer="/intent")
        assert err.pointer == "/intent"

    def test_missing_code(self):
        with pytest.raises(ValidationError):
            RpcError(message="no code")


class TestRuntimeEvent:
    """RuntimeEvent must have a known type."""

    def test_state_changed_event(self):
        evt = RuntimeEvent(
            type="StateChanged",
            payload={"run_id": "test-001", "current_node": "DEVELOPMENT"},
            timestamp="2026-07-21T00:00:00Z",
        )
        assert evt.type == "StateChanged"

    def test_unknown_type_rejected(self):
        with pytest.raises(ValidationError):
            RuntimeEvent(
                type="UNKNOWN_EVENT_XYZ",
                timestamp="2026-07-21T00:00:00Z",
            )


class TestProjectSummary:
    """ProjectSummary DTO."""

    def test_healthy_project(self):
        p = ProjectSummary(
            projectId="p1",
            name="test-project",
            protocolVersion="1.0",
            health="healthy",
        )
        assert p.health == "healthy"
        assert p.active_run_id is None


class TestRunStateDto:
    """RunStateDto."""

    def test_dto(self):
        dto = RunStateDto(
            runId="run-1",
            intent="FEATURE",
            risk="HIGH",
            status="IN_PROGRESS",
            currentNode="DEVELOPMENT",
            completedNodes=["INTAKE"],
            requiredNodes=["INTAKE", "DEVELOPMENT"],
        )
        assert dto.intent == "FEATURE"


class TestWorkflowDiagnostic:
    """WorkflowDiagnostic."""

    def test_error_diagnostic(self):
        diag = WorkflowDiagnostic(
            code="WORKFLOW_DUPLICATE_NODE",
            severity="error",
            pointer="/nodes",
            message="Duplicate node INTAKE",
        )
        assert diag.severity == "error"
        assert diag.pointer.startswith("/")
