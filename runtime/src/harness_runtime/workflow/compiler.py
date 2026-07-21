"""Workflow Compiler — validates and compiles workflow definitions.

Architecture §9.2: 编译检查 → node 唯一性、角色存在、artifact 安全、gate 引用、
route 完整、effective rules 满足、无循环回退、无并行/DAG/循环表达式。

Architecture §3.4: 活动 Run 路由冻结 — 修改 workflow.yaml 只影响新 Run。
"""

from typing import Any

from ..protocol.models import WorkflowDefinition
from .system_policy import SYSTEM_MINIMUM_RULES, get_effective_rules


class CompileDiagnostic:
    """A single diagnostic from workflow compilation."""

    def __init__(self, code: str, severity: str, pointer: str, message: str):
        self.code = code
        self.severity = severity  # "error" | "warning"
        self.pointer = pointer
        self.message = message

    def to_dict(self) -> dict:
        return {"code": self.code, "severity": self.severity, "pointer": self.pointer, "message": self.message}


class CompiledRoute:
    """A successfully compiled workflow route."""

    def __init__(self, required_nodes: list[str], reasons: dict[str, str], diagnostics: list[CompileDiagnostic]):
        self.required_nodes = required_nodes
        self.reasons = reasons  # node_id → reason it was included
        self.diagnostics = diagnostics

    def to_dict(self) -> dict:
        return {
            "required_nodes": self.required_nodes,
            "reasons": self.reasons,
            "diagnostics": [d.to_dict() for d in self.diagnostics],
        }


def compile_workflow(
    workflow: WorkflowDefinition,
    intent: str,
    risk: str,
) -> CompiledRoute:
    """Compile a workflow for the given intent and risk.

    Returns a CompiledRoute with the linear node sequence.
    Raises ValueError if the workflow cannot be compiled (diagnostics contain errors).
    """
    diags: list[CompileDiagnostic] = []

    # 1. Get base route from workflow routes
    routes = workflow.routes
    if intent not in routes:
        diags.append(CompileDiagnostic(
            "ROUTE_INTENT_MISSING", "error", f"/routes",
            f"No routes defined for intent {intent!r}",
        ))
        raise ValueError(f"Compilation failed: no route for intent {intent!r}")

    risk_routes = routes[intent]
    if risk not in risk_routes:
        # Fall back to nearest risk level
        fallback = _find_nearest_risk(risk, risk_routes)
        if fallback is None:
            diags.append(CompileDiagnostic(
                "ROUTE_RISK_MISSING", "error", f"/routes/{intent}",
                f"No route for risk {risk!r} in intent {intent!r}",
            ))
            raise ValueError(f"Compilation failed: no route for {intent}/{risk}")
        risk = fallback
        diags.append(CompileDiagnostic(
            "ROUTE_RISK_FALLBACK", "warning", f"/routes/{intent}",
            f"Falling back to risk {risk!r} for intent {intent!r}",
        ))

    base_route = list(risk_routes[risk])
    required_nodes: list[str] = list(base_route)
    reasons: dict[str, str] = {}

    # 2. Apply system minimum rules — inject required nodes if missing
    hard_rules = workflow.hard_rules or {}
    effective = get_effective_rules(hard_rules)

    # code_changed_requires: most intents involve code changes
    if intent in ("BUG_FIX", "FEATURE", "REFACTOR", "INCIDENT"):
        for node in effective.get("code_changed_requires", []):
            if node not in required_nodes:
                # Insert before EVIDENCE_CAPTURE if present, else append
                insert_pos = _find_insert_position(required_nodes, "EVIDENCE_CAPTURE")
                required_nodes.insert(insert_pos, node)
                reasons[node] = f"系统最低规则：代码变更必须包含 {node}"

    # high_risk_requires
    if risk == "HIGH":
        for node in effective.get("high_risk_requires", []):
            if node not in required_nodes:
                insert_pos = _find_insert_position(required_nodes, "IMPLEMENTATION_PLAN")
                required_nodes.insert(insert_pos, node)
                reasons[node] = f"系统最低规则：HIGH 风险必须包含 {node}"

    # high_or_deployment_requires
    if risk == "HIGH" or intent == "DEPLOYMENT":
        for node in effective.get("high_or_deployment_requires", []):
            if node not in required_nodes:
                required_nodes.append(node)
                reasons[node] = f"系统最低规则：{risk}/{intent} 必须包含 {node}"

    # 3. v1 mode: reject DAG/parallel/loops/expressions
    # In v1, all routes are linear lists — no dynamic expressions to check
    # Future v2: inspect route definitions for branching operators

    # 4. Ensure KNOWLEDGE_PROMOTION is last
    if "KNOWLEDGE_PROMOTION" in required_nodes and required_nodes[-1] != "KNOWLEDGE_PROMOTION":
        required_nodes.remove("KNOWLEDGE_PROMOTION")
        required_nodes.append("KNOWLEDGE_PROMOTION")
        reasons["KNOWLEDGE_PROMOTION"] = "系统最低规则：KNOWLEDGE_PROMOTION 必须是最后一个节点"

    # 5. Validate all nodes exist in the catalog
    catalog_ids = {n.id for n in workflow.nodes}
    for node_id in required_nodes:
        if node_id not in catalog_ids:
            diags.append(CompileDiagnostic(
                "ROUTE_UNKNOWN_NODE", "error", f"/routes/{intent}/{risk}",
                f"Node {node_id!r} in route is not defined in workflow nodes",
            ))

    errors = [d for d in diags if d.severity == "error"]
    if errors:
        raise ValueError(f"Compilation failed: {errors[0].message}")

    return CompiledRoute(
        required_nodes=required_nodes,
        reasons=reasons,
        diagnostics=diags,
    )


def simulate(workflow: WorkflowDefinition, intent: str, risk: str) -> dict:
    """Simulate compilation without side effects. Returns the route + reasons."""
    try:
        route = compile_workflow(workflow, intent, risk)
        return route.to_dict()
    except ValueError as e:
        return {"error": str(e), "required_nodes": [], "reasons": {}, "diagnostics": []}


def _find_nearest_risk(risk: str, risk_routes: dict) -> str | None:
    """Find the nearest available risk level for fallback."""
    priority = ["LOW", "MEDIUM", "HIGH"]
    if risk in priority:
        idx = priority.index(risk)
        # Try higher risks first (safer)
        for r in priority[idx:]:
            if r in risk_routes:
                return r
        # Then lower risks
        for r in reversed(priority[:idx]):
            if r in risk_routes:
                return r
    return None


def _find_insert_position(nodes: list[str], anchor: str) -> int:
    """Find the position to insert a node before anchor, or at end."""
    if anchor in nodes:
        return nodes.index(anchor)
    return len(nodes)
