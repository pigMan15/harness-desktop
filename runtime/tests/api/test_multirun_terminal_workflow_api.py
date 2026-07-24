import asyncio
import base64
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pytest

from harness_runtime.api.app import _dispatch
from harness_runtime.persistence.audit import query_events
from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.persistence.state_store import read_run_state, write_state
from harness_runtime.projects.service import import_project

FIXTURE = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1" / "valid-project"


@pytest.fixture
def project(tmp_path, monkeypatch):
    db_path = tmp_path / "api-feature.db"
    monkeypatch.setattr("harness_runtime.persistence.database.DEFAULT_DB_PATH", db_path)
    monkeypatch.setattr(
        "harness_runtime.projects.service.get_db", lambda: get_db(db_path)
    )
    init_db(db_path)
    root = tmp_path / "project"
    shutil.copytree(FIXTURE, root)
    state = json.loads((root / ".harness" / "state.json").read_text(encoding="utf-8"))
    state.update(
        {
            "run_id": "api-feature-run",
            "status": "DEVELOPING",
            "current_node": "DEVELOPMENT",
            "next_role": "developer",
            "phase_dir": ".harness/phases/api-feature-run",
            "required_nodes": ["DEVELOPMENT", "COMPILE"],
            "completed_nodes": [],
            "artifacts": {},
        }
    )
    phase = root / state["phase_dir"]
    phase.mkdir(parents=True)
    revision = write_state(root, state)
    registered = import_project(str(root))
    return registered["projectId"], root, state, phase, revision


def test_run_context_and_node_complete_are_explicitly_run_scoped(
    project, monkeypatch
):
    project_id, root, state, phase, revision = project
    assigned = root.parent / "run-worktree"
    assigned.mkdir()
    monkeypatch.setattr(
        "harness_runtime.runs.service.ensure_run_worktree",
        lambda *_args: {
            "branch_name": "codex/api-feature-run",
            "worktree_path": str(assigned),
            "worktree_status": "ready",
        },
    )
    context = asyncio.run(
        _dispatch(
            "run.executionContext",
            {
                "projectId": project_id,
                "runId": state["run_id"],
                "expectedRevision": revision,
            },
        )
    )
    (phase / "11-development.md").write_text("# Development\n", encoding="utf-8")
    completed = asyncio.run(
        _dispatch(
            "node.complete",
            {
                "projectId": project_id,
                "runId": state["run_id"],
                "expectedRevision": context["revision"],
            },
        )
    )

    assert context["runId"] == state["run_id"]
    assert context["worktreePath"] == str(assigned.resolve())
    assert completed["run"]["current_node"] == "COMPILE"
    audit = query_events(project_id=project_id, run_id=state["run_id"])
    assert audit[0]["event_type"] == "node_completed"
    assert audit[0]["node_id"] == "DEVELOPMENT"


def test_node_confirmation_writes_human_decision_audit(project):
    project_id, root, state, phase, revision = project
    state.update(
        {
            "current_node": "CODING_DESIGN_CONFIRMATION",
            "next_role": "developer",
            "required_nodes": ["CODING_DESIGN_CONFIRMATION", "DEVELOPMENT"],
        }
    )
    revision = write_state(root, state, expected_revision=revision)
    (phase / "10-coding-design.md").write_text("# Design\n", encoding="utf-8")

    asyncio.run(
        _dispatch(
            "node.confirm",
            {
                "projectId": project_id,
                "runId": state["run_id"],
                "decision": "accept",
                "comment": "approved for implementation",
                "confirmedBy": "release-owner",
                "expectedRevision": revision,
            },
        )
    )

    audit = query_events(project_id=project_id, run_id=state["run_id"])
    assert audit[0]["event_type"] == "node_confirmed"
    assert audit[0]["node_id"] == "CODING_DESIGN_CONFIRMATION"
    assert "release-owner" in audit[0]["summary"]


def test_gate_waiver_requires_verifier_and_auditable_metadata(project):
    project_id, root, state, _phase, revision = project
    state["current_node"] = "COMPILE"
    state["next_role"] = "verifier"
    revision = write_state(root, state, expected_revision=revision)

    waived = asyncio.run(
        _dispatch(
            "gate.waive",
            {
                "projectId": project_id,
                "runId": state["run_id"],
                "gateId": "G3_COMPILE",
                "scope": "clean VM only",
                "reason": "VM unavailable",
                "owner": "release-owner",
                "expectedRevision": revision,
            },
        )
    )

    persisted, _ = read_run_state(root, state["run_id"])
    assert waived["status"] == "WAIVED"
    assert persisted["waivers"]["G3_COMPILE"]["time"]


def test_workflow_export_import_apply_and_versions_round_trip(project):
    project_id, _root, _state, _phase, _revision = project
    current = asyncio.run(_dispatch("workflow.get", {"projectId": project_id}))
    exported = asyncio.run(
        _dispatch("workflow.export", {"projectId": project_id, "format": "zip"})
    )
    imported = asyncio.run(
        _dispatch(
            "workflow.import",
            {
                "projectId": project_id,
                "format": "zip",
                "content": exported["content"],
            },
        )
    )
    applied = asyncio.run(
        _dispatch(
            "workflow.apply",
            {
                "projectId": project_id,
                "yaml": imported["yaml"],
                "hash": current["hash"],
                "author": "tester",
                "summary": "round trip",
            },
        )
    )
    versions = asyncio.run(
        _dispatch("workflow.versions", {"projectId": project_id})
    )

    assert base64.b64decode(exported["content"])
    assert imported["success"] is True
    assert imported["manifest"]["files"]["workflow.yaml"]
    assert imported["structured"]["routes"]
    assert applied["success"] is True
    assert versions[0]["author"] == "tester"


def test_workflow_get_uses_explicit_run_snapshot(project):
    project_id, root, state, _phase, revision = project
    other = dict(state)
    other.update({"run_id": "other-run", "current_node": "COMPILE", "next_role": "verifier"})
    write_state(root, other, expected_revision=revision)

    result = asyncio.run(
        _dispatch("workflow.get", {"projectId": project_id, "runId": state["run_id"]})
    )

    assert result["state"]["run_id"] == state["run_id"]
    assert result["state"]["current_node"] == "DEVELOPMENT"
    assert result["effective_hard_rules"]["code_changed_requires"]


def test_terminal_projection_and_diagnostics_are_bounded_and_redacted(project):
    project_id, _root, state, _phase, _revision = project
    session = {
        "sessionId": "session-a",
        "runId": state["run_id"],
        "nodeId": state["current_node"],
        "status": "running",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "cwd": "G:/safe/worktree",
        "summary": "Authorization: bearer-secret token=private-value sk-abcdefghijklmnop",
    }
    asyncio.run(
        _dispatch(
            "terminal.session.update",
            {"projectId": project_id, "session": session},
        )
    )
    sessions = asyncio.run(
        _dispatch(
            "terminal.session.list",
            {"projectId": project_id, "runId": state["run_id"]},
        )
    )
    diagnostics = asyncio.run(
        _dispatch("diagnostics.export", {"projectId": project_id})
    )

    assert sessions[0]["sessionId"] == "session-a"
    serialized = json.dumps(diagnostics)
    assert "bearer-secret" not in serialized
    assert "private-value" not in serialized
    assert "sk-abcdefghijklmnop" not in serialized
    assert "[REDACTED]" in serialized


def test_archive_rejects_active_terminal_projection(project):
    project_id, _root, state, _phase, revision = project
    asyncio.run(
        _dispatch(
            "terminal.session.update",
            {
                "projectId": project_id,
                "session": {
                    "sessionId": "archive-active",
                    "runId": state["run_id"],
                    "nodeId": state["current_node"],
                    "status": "running",
                    "startedAt": datetime.now(timezone.utc).isoformat(),
                },
            },
        )
    )

    with pytest.raises(RuntimeError, match="RUN_ARCHIVE_ACTIVE_SESSION"):
        asyncio.run(
            _dispatch(
                "run.archive",
                {
                    "projectId": project_id,
                    "runId": state["run_id"],
                    "expectedRevision": revision,
                },
            )
        )
