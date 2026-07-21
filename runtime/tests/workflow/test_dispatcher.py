"""Tests for Dispatcher (Task 3.3)."""

import pytest

from harness_runtime.workflow.dispatcher import change_request, confirm_node, next_node


class TestNextNode:
    """Dispatcher selects the first uncompleted required node."""

    def test_first_uncompleted(self):
        state = {
            "required_nodes": ["INTAKE", "DEVELOPMENT", "COMPILE"],
            "completed_nodes": [],
        }
        assert next_node(state) == "INTAKE"

    def test_second_uncompleted(self):
        state = {
            "required_nodes": ["INTAKE", "DEVELOPMENT", "COMPILE"],
            "completed_nodes": ["INTAKE"],
        }
        assert next_node(state) == "DEVELOPMENT"

    def test_all_completed(self):
        state = {
            "required_nodes": ["INTAKE", "DEVELOPMENT"],
            "completed_nodes": ["INTAKE", "DEVELOPMENT"],
        }
        assert next_node(state) is None


class TestConfirm:
    """Human confirmation for confirmation nodes."""

    def test_accept(self):
        state = {"required_nodes": ["REQUIREMENT_CONFIRMATION"], "completed_nodes": []}
        state = confirm_node(state, "REQUIREMENT_CONFIRMATION", "accepted")
        assert "REQUIREMENT_CONFIRMATION" in state["confirmations"]
        assert state["confirmations"]["REQUIREMENT_CONFIRMATION"]["decision"] == "accepted"

    def test_reject(self):
        state = {"required_nodes": ["SOLUTION_CONFIRMATION"], "completed_nodes": [], "blocked_by": []}
        state = confirm_node(state, "SOLUTION_CONFIRMATION", "rejected", "需要修改设计")
        assert "rejected_SOLUTION_CONFIRMATION" in state["blocked_by"]

    def test_invalid_decision(self):
        state = {"required_nodes": [], "completed_nodes": []}
        with pytest.raises(ValueError, match="Invalid decision"):
            confirm_node(state, "REQUIREMENT_CONFIRMATION", "maybe")


class TestChangeRequest:
    """Route migration for active runs."""

    def test_change_request_preserves_completed(self):
        state = {
            "required_nodes": ["INTAKE", "DEVELOPMENT", "COMPILE"],
            "completed_nodes": ["INTAKE", "DEVELOPMENT"],
        }
        new_route = ["INTAKE", "SOLUTION_DESIGN", "DEVELOPMENT", "COMPILE", "EVIDENCE_CAPTURE"]
        state = change_request(state, new_route, "需要增加方案设计")

        assert "SOLUTION_DESIGN" in state["required_nodes"]
        assert "EVIDENCE_CAPTURE" in state["required_nodes"]
        # Completed nodes that are still in the new route should be preserved
        assert "INTAKE" in state["completed_nodes"]
        # "DEVELOPMENT" should still be completed
        assert "DEVELOPMENT" in state["completed_nodes"]
