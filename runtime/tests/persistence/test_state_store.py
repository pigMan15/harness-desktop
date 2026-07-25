"""Tests for Atomic State Store (Task 2.3).

Includes fault injection tests:
- os.replace failure preserves old file
- os.fsync failure does not report success
- Concurrent revision conflict
- Lock timeout
- Snapshot consistency
"""

import json
import os
import tempfile
from pathlib import Path
from unittest import mock

import pytest

from harness_runtime.persistence.atomic_files import atomic_read, atomic_write
from harness_runtime.persistence.project_lock import ProjectLock
from harness_runtime.persistence.state_store import read_run_state, read_state, write_state


@pytest.fixture
def project_dir():
    """Create a temporary project directory with .harness/ structure."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / ".harness").mkdir()
        (root / ".harness" / "runs").mkdir()
        yield root


@pytest.fixture
def sample_state():
    return {
        "schema_version": "1.0",
        "run_id": "test-run-001",
        "status": "IN_PROGRESS",
        "current_node": "DEVELOPMENT",
        "next_role": "developer",
        "phase_dir": ".harness/phases/test-run-001",
        "intent": "FEATURE",
        "risk": "HIGH",
        "required_nodes": ["INTAKE", "DEVELOPMENT"],
        "completed_nodes": ["INTAKE"],
        "artifacts": {"INTAKE": "00-intake.md"},
        "gates": {"G1_REQUIREMENTS": "PASS"},
        "retry_counts": {},
        "notes": "test",
    }


class TestAtomicReadWrite:
    """Basic atomic read/write operations."""

    def test_write_and_read(self, project_dir, sample_state):
        path = project_dir / ".harness" / "state.json"
        content = json.dumps(sample_state, ensure_ascii=False, indent=2) + "\n"
        rev = atomic_write(path, content)
        assert len(rev) == 64  # SHA-256 hex
        read_back = atomic_read(path)
        assert json.loads(read_back) == sample_state

    def test_write_overwrites(self, project_dir, sample_state):
        path = project_dir / ".harness" / "state.json"
        atomic_write(path, json.dumps(sample_state))
        sample_state["status"] = "DONE"
        atomic_write(path, json.dumps(sample_state))
        read_back = json.loads(atomic_read(path))
        assert read_back["status"] == "DONE"


class TestFaultInjection:
    """Fault injection tests for atomic writes."""

    def test_replace_failure_preserves_old_file(self, project_dir, sample_state):
        """Architecture §10: os.replace 失败时旧文件保持完整。"""
        path = project_dir / ".harness" / "state.json"
        old_content = json.dumps(sample_state)
        atomic_write(path, old_content)

        new_state = {**sample_state, "status": "DONE"}
        new_content = json.dumps(new_state)

        with mock.patch("os.replace", side_effect=OSError("simulated replace failure")):
            with pytest.raises(OSError):
                atomic_write(path, new_content)

        # Old file should still be intact
        read_back = json.loads(atomic_read(path))
        assert read_back["status"] == "IN_PROGRESS"  # NOT "DONE"

    def test_fsync_failure_cleans_temp(self, project_dir, sample_state):
        """Architecture §10: fsync 失败不报成功。"""
        path = project_dir / ".harness" / "state.json"
        atomic_write(path, json.dumps(sample_state))

        # Count temp files before
        parent = path.parent
        before = len(list(parent.glob(".tmp-*")))

        with mock.patch("os.fsync", side_effect=OSError("simulated fsync failure")):
            with pytest.raises(OSError):
                atomic_write(path, json.dumps({**sample_state, "status": "DONE"}))

        # Temp file should be cleaned up
        after = len(list(parent.glob(".tmp-*")))
        assert after <= before  # No extra temp files left behind


class TestProjectLock:
    """Project lock acquisition and release."""

    def test_acquire_and_release(self, project_dir):
        lock = ProjectLock(project_dir, timeout=1)
        assert lock.acquire()
        lock.release()
        assert not (project_dir / ".harness" / ".lock").exists()

    def test_context_manager(self, project_dir):
        with ProjectLock(project_dir, timeout=1):
            assert (project_dir / ".harness" / ".lock").exists()
        assert not (project_dir / ".harness" / ".lock").exists()

    def test_lock_timeout(self, project_dir):
        lock1 = ProjectLock(project_dir, timeout=1)
        assert lock1.acquire()
        try:
            lock2 = ProjectLock(project_dir, timeout=0.2)
            assert not lock2.acquire()  # Should timeout
        finally:
            lock1.release()


class TestStateStore:
    """State store with revision checks and snapshots."""

    def test_read_empty_state(self, project_dir):
        state, rev = read_state(project_dir)
        assert state == {}
        assert rev == ""

    def test_write_and_read_state(self, project_dir, sample_state):
        rev = write_state(project_dir, sample_state)
        assert len(rev) == 64
        state, read_rev = read_state(project_dir)
        assert state["run_id"] == "test-run-001"
        assert read_rev == rev

    def test_revision_conflict(self, project_dir, sample_state):
        """Architecture §10: 并发的 expected_revision 不匹配 → REVISION_CONFLICT。"""
        write_state(project_dir, sample_state, expected_revision=None)

        # Simulate stale revision
        with pytest.raises(RuntimeError, match="REVISION_CONFLICT"):
            write_state(project_dir, sample_state, expected_revision="deadbeef" * 8)

    def test_snapshot_saved(self, project_dir, sample_state):
        """Architecture §10: 成功后保存快照到 runs/<run-id>/state.json。"""
        write_state(project_dir, sample_state)
        snapshot_path = project_dir / ".harness" / "runs" / "test-run-001" / "state.json"
        assert snapshot_path.is_file()
        snapshot = json.loads(atomic_read(snapshot_path))
        assert snapshot["run_id"] == "test-run-001"

    def test_multiple_writes(self, project_dir, sample_state):
        """Sequential writes with correct revision should work."""
        rev1 = write_state(project_dir, sample_state)
        sample_state["completed_nodes"].append("DEVELOPMENT")
        sample_state["current_node"] = "COMPILE"
        rev2 = write_state(project_dir, sample_state, expected_revision=rev1)
        assert rev2 != rev1

        state, _ = read_state(project_dir)
        assert "DEVELOPMENT" in state["completed_nodes"]

    def test_read_run_state_reconciles_newer_worktree_state(self, project_dir, sample_state, tmp_path):
        worktree = tmp_path / "run-worktree"
        worktree.mkdir()
        main_state = {
            **sample_state,
            "run_id": "worktree-sync",
            "status": "ROUTING",
            "current_node": "INTAKE",
            "completed_nodes": [],
            "last_updated": "2026-07-25T01:00:00+00:00",
            "branch_name": "codex/worktree-sync",
            "worktree_path": str(worktree),
            "worktree_status": "ready",
        }
        main_snapshot = project_dir / ".harness" / "runs" / "worktree-sync" / "state.json"
        main_snapshot.parent.mkdir(parents=True)
        main_snapshot.write_text(
            json.dumps(main_state, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (project_dir / ".harness" / "state.json").write_text(
            json.dumps(main_state, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        worktree_state = {
            **main_state,
            "status": "DONE",
            "current_node": "KNOWLEDGE_PROMOTION",
            "completed_nodes": ["INTAKE", "KNOWLEDGE_PROMOTION"],
            "last_updated": "2026-07-25T02:00:00+00:00",
        }
        del worktree_state["worktree_path"]
        target = worktree / ".harness" / "runs" / "worktree-sync"
        target.mkdir(parents=True)
        (target / "state.json").write_text(
            json.dumps(worktree_state, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        reconciled, _ = read_run_state(project_dir, "worktree-sync")
        projected, _ = read_state(project_dir)

        assert reconciled["status"] == "DONE"
        assert reconciled["worktree_path"] == str(worktree)
        assert projected["status"] == "DONE"
        assert json.loads(
            (project_dir / ".harness" / "runs" / "worktree-sync" / "state.json").read_text(encoding="utf-8")
        )["status"] == "DONE"
