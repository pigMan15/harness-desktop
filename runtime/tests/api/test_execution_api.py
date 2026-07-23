"""Execution API tests for active-run context and Codex session ownership."""

import asyncio
import json
import shutil
from pathlib import Path

import pytest

import harness_runtime.api.app as api_app
from harness_runtime.api.app import _dispatch
from harness_runtime.executors.base import ExecutorCapability
from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.projects.service import import_project
from harness_runtime.persistence.state_store import write_state
from harness_runtime.persistence.state_store import write_run_state
from harness_runtime.runs.service import switch_run


class _FakeCodexAdapter:
    def __init__(self):
        self.request = None
        self.requests = []
        self.responses = []
        self.cancelled = []
        self.sessions = 0

    async def probe(self):
        return ExecutorCapability(
            True,
            path="C:/tools/codex.exe",
            version="codex-cli 0.test",
            features=["app-server", "approval"],
        )

    async def start(self, request):
        self.request = request
        self.requests.append(request)
        self.sessions += 1
        return f"codex-session-{self.sessions}"

    def session_info(self, session_id):
        suffix = session_id.rsplit("-", 1)[-1]
        return {"pid": 4321, "threadId": f"thread-{suffix}", "turnId": f"turn-{suffix}"}

    def poll(self, _session_id):
        return [{"type": "output", "sequence": 1, "content": "working"}]

    async def respond(self, session_id, decision):
        self.responses.append((session_id, decision))

    async def cancel(self, session_id):
        self.cancelled.append(session_id)


@pytest.fixture
def execution_project(tmp_path, monkeypatch):
    db_path = tmp_path / "execution.db"
    monkeypatch.setattr("harness_runtime.persistence.database.DEFAULT_DB_PATH", db_path)
    monkeypatch.setattr(
        "harness_runtime.projects.service.get_db",
        lambda: get_db(db_path),
    )
    init_db(db_path)
    source = (
        Path(__file__).resolve().parents[3]
        / "fixtures"
        / "harness-v1"
        / "valid-project"
    )
    root = tmp_path / "execution-project"
    shutil.copytree(source, root)
    state_path = root / ".harness/state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state.update(
        {
            "run_id": "active-execution-run",
            "current_node": "DEVELOPMENT",
            "next_role": "developer",
            "phase_dir": ".harness/phases/active-execution-run",
            "worktree_path": str(root),
            "branch_name": "codex/active-execution-run",
            "worktree_status": "ready",
        }
    )
    state_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / state["phase_dir"]).mkdir(parents=True)
    write_state(root, state)
    adapter = _FakeCodexAdapter()
    monkeypatch.setattr(api_app, "_codex_adapter", adapter)
    return import_project(str(root)), root, adapter


def test_execution_probe_and_start_use_active_run_context(execution_project):
    project, root, adapter = execution_project
    project_id = project["projectId"]

    capability = asyncio.run(_dispatch("execution.probe", {"projectId": project_id}))
    started = asyncio.run(
        _dispatch(
            "execution.start",
            {
                "projectId": project_id,
                "runId": "active-execution-run",
                "nodeId": "INTAKE",
                "role": "dispatcher",
            },
        )
    )

    assert capability["available"] is True
    assert capability["features"][0] == "app-server"
    assert started["sessionId"] == "codex-session-1"
    assert started["runId"] == "active-execution-run"
    assert started["nodeId"] == "DEVELOPMENT"
    assert started["role"] == "developer"
    assert adapter.request.project_root == str(root)
    assert adapter.request.node_id == "DEVELOPMENT"
    assert adapter.request.role_file.endswith(".harness\\agents\\developer.md")

    row = get_db().execute(
        "SELECT * FROM executor_sessions WHERE id = ?", ("codex-session-1",)
    ).fetchone()
    assert row["project_id"] == project_id
    assert row["run_id"] == "active-execution-run"
    assert row["node_id"] == "DEVELOPMENT"
    recovered = asyncio.run(_dispatch("recovery.scan", {"projectId": project_id}))
    assert recovered[0]["run_id"] == "active-execution-run"
    assert recovered[0]["worktree_path"] == str(root.resolve())
    assert recovered[0]["branch_name"] == "codex/active-execution-run"
    assert recovered[0]["thread_id"] == "thread-1"


def test_execution_session_calls_require_owning_project(execution_project):
    project, _, adapter = execution_project
    project_id = project["projectId"]
    asyncio.run(_dispatch("execution.start", {"projectId": project_id, "runId": "active-execution-run"}))

    events = asyncio.run(
        _dispatch(
            "execution.poll",
            {"projectId": project_id, "runId": "active-execution-run", "sessionId": "codex-session-1"},
        )
    )
    asyncio.run(
        _dispatch(
            "execution.respond",
            {
                "projectId": project_id,
                "runId": "active-execution-run",
                "sessionId": "codex-session-1",
                "decision": {"requestId": 91, "decision": "allow_once"},
            },
        )
    )
    asyncio.run(
        _dispatch(
            "execution.cancel",
            {"projectId": project_id, "runId": "active-execution-run", "sessionId": "codex-session-1"},
        )
    )

    assert events[0]["content"] == "working"
    assert adapter.responses[-1][1]["requestId"] == 91
    assert adapter.cancelled == ["codex-session-1"]
    row = get_db().execute(
        "SELECT status FROM executor_sessions WHERE id = ?", ("codex-session-1",)
    ).fetchone()
    assert row["status"] == "cancelled"


def test_switching_selected_run_does_not_move_existing_session(execution_project):
    project, root, adapter = execution_project
    project_id = project["projectId"]
    first = asyncio.run(
        _dispatch(
            "execution.start",
            {"projectId": project_id, "runId": "active-execution-run"},
        )
    )

    second_worktree = root.parent / "second-worktree"
    second_worktree.mkdir()
    second_state = json.loads(
        (root / ".harness/runs/active-execution-run/state.json").read_text(encoding="utf-8")
    )
    second_state.update(
        {
            "run_id": "second-execution-run",
            "phase_dir": ".harness/phases/second-execution-run",
            "worktree_path": str(second_worktree),
            "branch_name": "codex/second-execution-run",
        }
    )
    (root / second_state["phase_dir"]).mkdir(parents=True)
    write_run_state(root, "second-execution-run", second_state, update_projection=False)
    switch_run(root, "second-execution-run")
    second = asyncio.run(
        _dispatch(
            "execution.start",
            {"projectId": project_id, "runId": "second-execution-run"},
        )
    )

    asyncio.run(
        _dispatch(
            "execution.poll",
            {
                "projectId": project_id,
                "runId": "active-execution-run",
                "sessionId": first["sessionId"],
            },
        )
    )
    with pytest.raises(PermissionError, match="EXECUTION_SESSION_RUN_MISMATCH"):
        asyncio.run(
            _dispatch(
                "execution.poll",
                {
                    "projectId": project_id,
                    "runId": "second-execution-run",
                    "sessionId": first["sessionId"],
                },
            )
        )

    rows = get_db().execute(
        "SELECT run_id, worktree_path, thread_id, turn_id FROM executor_sessions ORDER BY id"
    ).fetchall()
    assert first["sessionId"] == "codex-session-1"
    assert second["sessionId"] == "codex-session-2"
    assert rows[0]["run_id"] == "active-execution-run"
    assert rows[1]["run_id"] == "second-execution-run"
    assert rows[0]["worktree_path"] == str(root.resolve())
    assert rows[1]["worktree_path"] == str(second_worktree.resolve())
    assert rows[0]["thread_id"] == "thread-1"
    assert rows[1]["turn_id"] == "turn-2"
    assert adapter.requests[0].project_root != adapter.requests[1].project_root
