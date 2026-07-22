"""Approval service — request lifecycle around approval policy decisions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from .policy import classify_request, is_forbidden, requires_second_confirmation

AuditRecorder = Callable[[str, str, str | None, dict], None]


@dataclass
class ApprovalRequest:
    id: str
    tool: str
    params: dict
    category: str
    requested_by: str
    message: str
    created_at: str
    status: str = "pending"
    forbidden_prefix: str | None = None
    second_confirmation_required: bool = False
    decisions: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tool": self.tool,
            "params": self.params,
            "category": self.category,
            "requested_by": self.requested_by,
            "message": self.message,
            "created_at": self.created_at,
            "status": self.status,
            "forbidden_prefix": self.forbidden_prefix,
            "second_confirmation_required": self.second_confirmation_required,
            "decisions": self.decisions,
        }


class ApprovalService:
    """Create and resolve approval requests without weakening policy rules."""

    def __init__(self, audit_recorder: AuditRecorder | None = None):
        self._requests: dict[str, ApprovalRequest] = {}
        self._audit_recorder = audit_recorder

    def create_request(
        self,
        tool: str,
        params: dict,
        requested_by: str = "executor",
        message: str | None = None,
    ) -> ApprovalRequest:
        category = classify_request(tool, params)
        command = str(params.get("command", ""))
        forbidden = is_forbidden(command) if command else None
        request = ApprovalRequest(
            id=str(uuid4()),
            tool=tool,
            params=params,
            category=category,
            requested_by=requested_by,
            message=message or f"{tool} 请求 {category} 审批",
            created_at=_now(),
            forbidden_prefix=forbidden,
            second_confirmation_required=requires_second_confirmation(category),
        )
        self._requests[request.id] = request
        self._record("approval.requested", request, None, {"category": category})
        return request

    def get_request(self, request_id: str) -> ApprovalRequest:
        try:
            return self._requests[request_id]
        except KeyError as exc:
            raise KeyError(f"approval request not found: {request_id}") from exc

    def resolve(
        self,
        request_id: str,
        decision: str,
        actor: str = "user",
        second_confirmed: bool = False,
        reason: str = "",
    ) -> ApprovalRequest:
        request = self.get_request(request_id)
        if request.status != "pending":
            raise ValueError(f"approval request is already {request.status}")
        if decision not in ("allow_once", "deny"):
            raise ValueError(f"unsupported approval decision: {decision}")

        # 禁止前缀是系统底线，即使用户误点允许也不能放行。
        if decision == "allow_once" and request.forbidden_prefix:
            request.status = "denied"
            reason = reason or f"命令前缀 {request.forbidden_prefix} 被策略禁止"
        elif decision == "allow_once" and request.second_confirmation_required and not second_confirmed:
            raise ValueError("second confirmation required")
        else:
            request.status = "allowed" if decision == "allow_once" else "denied"

        request.decisions.append({
            "decision": decision,
            "actor": actor,
            "time": _now(),
            "reason": reason,
            "second_confirmed": second_confirmed,
        })
        self._record("approval.resolved", request, actor, {"decision": decision, "status": request.status})
        return request

    def _record(self, event_type: str, request: ApprovalRequest, actor: str | None, payload: dict) -> None:
        if self._audit_recorder:
            self._audit_recorder(event_type, request.id, actor, payload)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
