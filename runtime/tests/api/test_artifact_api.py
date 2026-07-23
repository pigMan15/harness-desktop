"""Artifact API isolation for explicit Run contexts."""

import asyncio
import json
import shutil
from pathlib import Path

import pytest

from harness_runtime.api.app import _dispatch
from harness_runtime.persistence.database import get_db, init_db
from harness_runtime.persistence.state_store import write_run_state
from harness_runtime.projects.service import import_project


@pytest.fixture
def artifact_project(tmp_path, monkeypatch):
    db_path = tmp_path / "artifacts.db"
    monkeypatch.setattr("harness_runtime.persistence.database.DEFAULT_DB_PATH", db_path)
    monkeypatch.setattr("harness_runtime.projects.service.get_db", lambda: get_db(db_path))
    init_db(db_path)
    source = Path(__file__).resolve().parents[3] / "fixtures/harness-v1/valid-project"
    root = tmp_path / "artifact-project"
    shutil.copytree(source, root)
    template = json.loads((root / ".harness/state.json").read_text(encoding="utf-8"))
    for run_id, content in (("artifact-a", "from A"), ("artifact-b", "from B")):
        state = {**template, "run_id": run_id, "phase_dir": f".harness/phases/{run_id}"}
        phase = root / state["phase_dir"]
        phase.mkdir(parents=True)
        (phase / "result.md").write_text(content, encoding="utf-8")
        write_run_state(root, run_id, state, update_projection=False)
    return import_project(str(root))


def test_list_and_read_are_bound_to_requested_run(artifact_project):
    project_id = artifact_project["projectId"]
    listed = asyncio.run(
        _dispatch("artifact.list", {"projectId": project_id, "runId": "artifact-b"})
    )
    result = asyncio.run(
        _dispatch(
            "artifact.read",
            {"projectId": project_id, "runId": "artifact-b", "filename": "result.md"},
        )
    )

    assert [item["name"] for item in listed] == ["result.md"]
    assert result["content"] == "from B"
