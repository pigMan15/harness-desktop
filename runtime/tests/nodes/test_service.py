import json
import shutil
from pathlib import Path

import pytest

from harness_runtime.nodes.service import complete_node, decide_node
from harness_runtime.persistence.state_store import read_run_state, write_state

FIXTURE = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1" / "valid-project"


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "project"
    shutil.copytree(FIXTURE, root)
    state = json.loads((root / ".harness" / "state.json").read_text(encoding="utf-8"))
    state.update(
        {
            "run_id": "node-run",
            "status": "DEVELOPING",
            "current_node": "DEVELOPMENT",
            "next_role": "developer",
            "phase_dir": ".harness/phases/node-run",
            "required_nodes": ["DEVELOPMENT", "COMPILE"],
            "completed_nodes": [],
            "artifacts": {},
        }
    )
    phase = root / state["phase_dir"]
    phase.mkdir(parents=True)
    revision = write_state(root, state)
    return root, state, phase, revision


def test_complete_validates_artifact_and_advances_dispatcher(project):
    root, state, phase, revision = project
    (phase / "11-development.md").write_text("# Development\n", encoding="utf-8")

    result = complete_node(root, state["run_id"], expected_revision=revision)
    persisted, persisted_revision = read_run_state(root, state["run_id"])

    assert result["run"]["current_node"] == "COMPILE"
    assert result["run"]["next_role"] == "verifier"
    assert persisted["completed_nodes"] == ["DEVELOPMENT"]
    assert persisted_revision == result["revision"]


def test_complete_rejects_missing_and_stale_artifact(project):
    root, state, _phase, revision = project

    with pytest.raises(ValueError, match="ARTIFACT_MISSING"):
        complete_node(root, state["run_id"], expected_revision=revision)

    with pytest.raises(RuntimeError, match="REVISION_CONFLICT"):
        complete_node(root, state["run_id"], expected_revision="deadbeef" * 8)


def test_confirmation_records_human_decision_before_advancing(project):
    root, state, phase, revision = project
    state.update(
        {
            "current_node": "CODING_DESIGN_CONFIRMATION",
            "next_role": "developer",
            "required_nodes": ["CODING_DESIGN_CONFIRMATION", "DEVELOPMENT"],
        }
    )
    revision = write_state(root, state, expected_revision=revision)
    (phase / "10-coding-design.md").write_text("# Design\n", encoding="utf-8")

    result = decide_node(
        root,
        state["run_id"],
        decision="accept",
        comment="approved",
        confirmed_by="tester",
        expected_revision=revision,
    )

    assert result["run"]["current_node"] == "DEVELOPMENT"
    assert result["run"]["confirmations"]["CODING_DESIGN_CONFIRMATION"]["decision"] == "accepted"
    assert result["run"]["confirmations"]["CODING_DESIGN_CONFIRMATION"]["confirmed_by"] == "tester"


def test_terminal_exit_metadata_never_completes_node(project):
    root, state, _phase, revision = project
    state["terminal_sessions"] = {"s1": {"status": "exited", "exit_code": 0}}
    write_state(root, state, expected_revision=revision)

    persisted, _ = read_run_state(root, state["run_id"])

    assert persisted["current_node"] == "DEVELOPMENT"
    assert persisted["completed_nodes"] == []
