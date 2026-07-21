"""Executor Adapter contract — architecture §12.

All executors (Codex, Fake) implement this interface.
probe/start/stream/respond/cancel/recover — unified event model.
"""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterable, Optional


class ExecutorCapability:
    """Result of probe() — what the executor can do."""

    def __init__(self, available: bool, path: str = "", version: str = "",
                 features: Optional[list[str]] = None, diagnostics: Optional[str] = None):
        self.available = available
        self.path = path
        self.version = version
        self.features = features or []
        self.diagnostics = diagnostics  # actionable diagnostic if unavailable


class ExecutionRequest:
    """Input to start() — architecture §12: only current node context."""

    def __init__(self, project_root: str, run_id: str, node_id: str,
                 role_file: str, rules: list[str], phase_dir: str,
                 context: Optional[dict] = None, approval_policy: Optional[dict] = None):
        self.project_root = project_root
        self.run_id = run_id
        self.node_id = node_id
        self.role_file = role_file
        self.rules = rules
        self.phase_dir = phase_dir
        self.context = context or {}
        self.approval_policy = approval_policy or {}


class ExecutionEvent:
    """Unified event from executor stream."""

    def __init__(self, event_type: str, sequence: int = 0, data: Optional[dict] = None):
        self.type = event_type  # output, tool_call, approval_required, exited, error
        self.sequence = sequence
        self.data = data or {}


class ExecutorAdapter(ABC):
    """Abstract executor adapter — architecture §12."""

    @abstractmethod
    async def probe(self) -> ExecutorCapability:
        """Check if the executor is available and return capabilities."""

    @abstractmethod
    async def start(self, request: ExecutionRequest) -> str:
        """Start an execution session. Returns session_id."""

    @abstractmethod
    async def stream(self, session_id: str) -> AsyncIterable[ExecutionEvent]:
        """Stream execution events from the session."""

    @abstractmethod
    async def respond(self, session_id: str, decision: dict) -> None:
        """Send a user decision (approve/deny) to the executor."""

    @abstractmethod
    async def cancel(self, session_id: str) -> None:
        """Cancel a running session (graceful → timeout → force kill)."""

    @abstractmethod
    async def recover(self, session_id: str) -> Optional[dict]:
        """Try to recover an interrupted session."""
