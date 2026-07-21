"""Tests for Knowledge Promotion (Task 6.3)."""

import pytest

from harness_runtime.knowledge.service import list_candidates, promote_candidate, review_candidate

PROJECT_ID = "test-knowledge-001"
RUN_ID = "test-run-001"


@pytest.fixture(autouse=True)
def setup_db(monkeypatch, tmp_path):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(
        "harness_runtime.knowledge.service.get_db",
        lambda: __import__("harness_runtime.persistence.database", fromlist=["get_db"]).get_db(db_path),
    )
    from harness_runtime.persistence.database import init_db
    init_db(db_path)


class TestPromotion:
    def test_promote_candidate(self):
        cid = promote_candidate(PROJECT_ID, RUN_ID, "Test Pattern", "A useful pattern", "test_run", "case")
        assert cid > 0

    def test_list_drafts(self):
        promote_candidate(PROJECT_ID, RUN_ID, "T1", "S1", "src", "case")
        promote_candidate(PROJECT_ID, RUN_ID, "T2", "S2", "src", "pitfall")
        candidates = list_candidates(PROJECT_ID)
        assert len(candidates) >= 2

    def test_review_accept(self):
        cid = promote_candidate(PROJECT_ID, RUN_ID, "T", "S", "src")
        result = review_candidate(cid, "accepted")
        assert result["status"] == "accepted"

    def test_review_reject(self):
        cid = promote_candidate(PROJECT_ID, RUN_ID, "T", "S", "src")
        result = review_candidate(cid, "rejected")
        assert result["status"] == "rejected"
