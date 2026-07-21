"""Tests for Workflow Compiler (Task 3.1)."""

from pathlib import Path

import pytest

from harness_runtime.protocol.loader import load_workflow
from harness_runtime.workflow.compiler import compile_workflow, simulate
from harness_runtime.workflow.system_policy import SYSTEM_MINIMUM_RULES, get_effective_rules

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "harness-v1"
VALID_WF = load_workflow(FIXTURES / "valid-project")


class TestSystemPolicy:
    """System minimum rules are immutable."""

    def test_system_rules_not_empty(self):
        assert "code_changed_requires" in SYSTEM_MINIMUM_RULES
        assert "COMPILE" in SYSTEM_MINIMUM_RULES["code_changed_requires"]

    def test_effective_rules_union(self):
        project = {"code_changed_requires": ["CUSTOM_CHECK"]}
        effective = get_effective_rules(project)
        assert "COMPILE" in effective["code_changed_requires"]
        assert "CUSTOM_CHECK" in effective["code_changed_requires"]

    def test_effective_rules_immutable_fields(self):
        effective = get_effective_rules({})
        assert "intent" in effective["immutable_fields"]
        assert "risk" in effective["immutable_fields"]


class TestCompile:
    """Compile workflow routes."""

    def test_compile_feature_high(self):
        route = compile_workflow(VALID_WF, "FEATURE", "HIGH")
        assert len(route.required_nodes) >= 20
        assert "COMPILE" in route.required_nodes
        assert "UNIT_TEST" in route.required_nodes
        assert "EVIDENCE_CAPTURE" in route.required_nodes
        # HIGH must include confirmations
        assert "REQUIREMENT_CONFIRMATION" in route.required_nodes
        assert "PRE_MORTEM" in route.required_nodes

    def test_compile_bug_fix_low(self):
        route = compile_workflow(VALID_WF, "BUG_FIX", "LOW")
        assert route.required_nodes[0] == "INTAKE"
        # Code change must include compile/test/evidence
        assert "COMPILE" in route.required_nodes
        assert "UNIT_TEST" in route.required_nodes
        assert "EVIDENCE_CAPTURE" in route.required_nodes

    def test_compile_query(self):
        route = compile_workflow(VALID_WF, "QUERY", "NA")
        assert "COMPILE" not in route.required_nodes  # No code changes
        assert "KNOWLEDGE_PROMOTION" in route.required_nodes

    def test_compile_deployment_high(self):
        route = compile_workflow(VALID_WF, "DEPLOYMENT", "HIGH")
        # Deployment + HIGH must include prerelease + interface test
        assert "PRERELEASE_DEPLOYMENT" in route.required_nodes
        assert "INTERFACE_TEST" in route.required_nodes

    def test_simulate_returns_route(self):
        result = simulate(VALID_WF, "FEATURE", "MEDIUM")
        assert len(result["required_nodes"]) > 0
        assert "reasons" in result

    def test_simulate_bad_intent(self):
        result = simulate(VALID_WF, "NONEXISTENT", "LOW")
        assert "error" in result

    def test_knowledge_promotion_is_last(self):
        route = compile_workflow(VALID_WF, "FEATURE", "HIGH")
        assert route.required_nodes[-1] == "KNOWLEDGE_PROMOTION"
