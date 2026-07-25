"""Tests for Knowledge Promotion (Task 6.3)."""

import pytest

from harness_runtime.knowledge.service import (
    list_candidates,
    list_candidates_with_content,
    promote_candidate,
    review_candidate,
)

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

    def test_list_with_content_dedupes_same_run_summary_and_content(self, tmp_path):
        first = tmp_path / "first.md"
        second = tmp_path / "second.md"
        first.write_text("# 知识沉淀\n\nsame reusable content\n", encoding="utf-8")
        second.write_text("# 知识沉淀\n\nsame reusable content\n", encoding="utf-8")
        promote_candidate(PROJECT_ID, RUN_ID, "知识沉淀", "same reusable content", str(first))
        promote_candidate(PROJECT_ID, RUN_ID, "知识沉淀", "same reusable content", str(second))

        candidates = list_candidates_with_content(PROJECT_ID, tmp_path, status="draft")

        assert len(candidates) == 1

    def test_review_updates_duplicate_drafts_together(self):
        first = promote_candidate(PROJECT_ID, RUN_ID, "知识沉淀", "same summary", "source-a")
        promote_candidate(PROJECT_ID, RUN_ID, "知识沉淀", "same summary", "source-b")

        review_candidate(first, "accepted")
        drafts = list_candidates(PROJECT_ID, status="draft")
        accepted = list_candidates(PROJECT_ID, status="accepted")

        assert drafts == []
        assert len(accepted) == 2
