"""Gate API tests bound to the selected project's active run."""

import asyncio
import json
import shutil
from pathlib import Path

import pytest

from harness_runtime.api.app import _dispatch
from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.persistence.state_store import read_run_state, read_state, write_run_state, write_state
from harness_runtime.projects.service import import_project


@pytest.fixture
def registered_project(tmp_path, monkeypatch):
    db_path = tmp_path / "gates.db"
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
    root = tmp_path / "gate-project"
    shutil.copytree(source, root)
    state_path = root / ".harness" / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["run_id"] = "active-gate-run"
    state["phase_dir"] = ".harness/phases/active-gate-run"
    state["gates"] = {f"G{i}_{name}": "NOT_RUN" for i, name in (
        (1, "REQUIREMENTS"),
        (2, "DESIGN"),
        (3, "COMPILE"),
        (4, "UNIT_TEST"),
        (5, "ATDD"),
        (6, "EVIDENCE"),
        (7, "PRERELEASE"),
        (8, "ACCEPTANCE"),
    )}
    state_path.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / state["phase_dir"]).mkdir(parents=True)
    write_state(root, state)
    project = import_project(str(root))
    return project, root


def test_gate_list_returns_active_run_context(registered_project):
    project, _ = registered_project

    result = asyncio.run(
        _dispatch("gate.list", {"projectId": project["projectId"], "runId": "active-gate-run"})
    )

    assert result["runId"] == "active-gate-run"
    assert result["currentNode"]
    assert result["nextRole"]
    assert len(result["revision"]) == 64
    assert result["gates"]["G3_COMPILE"] == "NOT_RUN"


def test_gate_evaluate_uses_engine_and_syncs_snapshot(registered_project):
    project, root = registered_project
    state, revision = read_state(root)
    state["next_role"] = "verifier"
    revision = write_state(root, state, expected_revision=revision)
    phase_dir = root / state["phase_dir"]
    (phase_dir / "12-compile.md").write_text("# Compile\n\nPASS\n", encoding="utf-8")

    result = asyncio.run(
        _dispatch(
            "gate.evaluate",
            {
                "projectId": project["projectId"],
                "runId": "active-gate-run",
                "gateId": "G3_COMPILE",
                "status": "FAIL",
                "expectedRevision": revision,
            },
        )
    )

    assert result["status"] == "PASS"
    assert result["runId"] == "active-gate-run"
    active, _ = read_state(root)
    snapshot = json.loads(
        (root / ".harness/runs/active-gate-run/state.json").read_text(encoding="utf-8")
    )
    assert active["gates"]["G3_COMPILE"] == "PASS"
    assert snapshot["gates"]["G3_COMPILE"] == "PASS"


def test_gate_evaluate_rejects_non_verifier_without_writing(registered_project):
    project, root = registered_project
    state, revision = read_state(root)
    state["next_role"] = "developer"
    revision = write_state(root, state, expected_revision=revision)
    (root / state["phase_dir"] / "12-compile.md").write_text(
        "# Compile\n\nPASS\n", encoding="utf-8"
    )

    with pytest.raises(PermissionError, match="GATE_PERMISSION_DENIED"):
        asyncio.run(
            _dispatch(
                "gate.evaluate",
                {
                    "projectId": project["projectId"],
                    "runId": "active-gate-run",
                    "gateId": "G3_COMPILE",
                    "expectedRevision": revision,
                },
            )
        )

    unchanged, unchanged_revision = read_state(root)
    assert unchanged_revision == revision
    assert unchanged["gates"]["G3_COMPILE"] == "NOT_RUN"


def test_gate_evaluation_only_updates_requested_run(registered_project):
    project, root = registered_project
    first, first_revision = read_run_state(root, "active-gate-run")
    first["next_role"] = "verifier"
    first_revision = write_run_state(
        root, "active-gate-run", first, expected_revision=first_revision
    )
    (root / first["phase_dir"] / "12-compile.md").write_text(
        "# Compile\n\nPASS\n", encoding="utf-8"
    )

    second = json.loads(json.dumps(first))
    second.update(
        {
            "run_id": "other-gate-run",
            "phase_dir": ".harness/phases/other-gate-run",
            "gates": {**first["gates"], "G3_COMPILE": "NOT_RUN"},
        }
    )
    (root / second["phase_dir"]).mkdir(parents=True)
    second_revision = write_run_state(
        root, "other-gate-run", second, update_projection=False
    )

    asyncio.run(
        _dispatch(
            "gate.evaluate",
            {
                "projectId": project["projectId"],
                "runId": "active-gate-run",
                "gateId": "G3_COMPILE",
                "expectedRevision": first_revision,
            },
        )
    )

    unchanged_second, unchanged_revision = read_run_state(root, "other-gate-run")
    assert unchanged_second["gates"]["G3_COMPILE"] == "NOT_RUN"
    assert unchanged_revision == second_revision
