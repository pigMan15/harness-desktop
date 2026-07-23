"""Runtime API project context isolation tests."""

import asyncio
import json
import shutil
from pathlib import Path

import pytest
import yaml

from harness_runtime.api.app import _dispatch
from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.projects.service import import_project


@pytest.fixture
def registered_projects(tmp_path, monkeypatch):
    db_path = tmp_path / "api.db"
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
    projects = []
    for name, run_id in (("alpha", "alpha-run"), ("beta", "beta-run")):
        root = tmp_path / name
        shutil.copytree(source, root)
        state_path = root / ".harness" / "state.json"
        state = json.loads(state_path.read_text(encoding="utf-8"))
        state["run_id"] = run_id
        state["phase_dir"] = f".harness/phases/{run_id}"
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
        projects.append(import_project(str(root)))
    return projects


def test_business_methods_require_project_id(registered_projects):
    with pytest.raises(ValueError, match="PROJECT_ID_REQUIRED"):
        asyncio.run(_dispatch("workflow.get", {}))


def test_workflow_calls_are_isolated_by_registered_project(registered_projects):
    alpha, beta = registered_projects

    alpha_workflow = asyncio.run(_dispatch("workflow.get", {"projectId": alpha["projectId"]}))
    beta_workflow = asyncio.run(_dispatch("workflow.get", {"projectId": beta["projectId"]}))

    assert alpha_workflow["state"]["run_id"] == "alpha-run"
    assert beta_workflow["state"]["run_id"] == "beta-run"


def test_workflow_preview_and_apply_round_trip(registered_projects):
    alpha, _ = registered_projects
    project_id = alpha["projectId"]
    current = asyncio.run(_dispatch("workflow.get", {"projectId": project_id}))
    original = yaml.safe_load(current["yaml"])
    route = list(reversed(original["routes"]["FEATURE"]["LOW"]))

    preview = asyncio.run(
        _dispatch(
            "workflow.preview",
            {
                "projectId": project_id,
                "nodes": original["nodes"],
                "intent": "FEATURE",
                "risk": "LOW",
                "route": route,
            },
        )
    )

    preview_workflow = yaml.safe_load(preview["yaml"])
    assert preview["success"] is True
    assert preview["base_hash"] == current["hash"]
    assert preview_workflow["routes"]["FEATURE"]["LOW"] == route
    assert preview_workflow["routes"]["QUERY"] == original["routes"]["QUERY"]
    assert preview_workflow["hard_rules"] == original["hard_rules"]

    applied = asyncio.run(
        _dispatch(
            "workflow.apply",
            {
                "projectId": project_id,
                "yaml": preview["yaml"],
                "hash": preview["base_hash"],
            },
        )
    )
    assert applied["success"] is True
    assert asyncio.run(_dispatch("workflow.get", {"projectId": project_id}))["hash"] == applied["hash"]

    stale_apply = asyncio.run(
        _dispatch(
            "workflow.apply",
            {
                "projectId": project_id,
                "yaml": current["yaml"],
                "hash": preview["base_hash"],
            },
        )
    )
    assert stale_apply["success"] is False
    assert stale_apply["error"] == "HASH_MISMATCH"
    assert asyncio.run(_dispatch("workflow.get", {"projectId": project_id}))["hash"] == applied["hash"]
