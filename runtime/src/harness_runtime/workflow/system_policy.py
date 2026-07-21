"""System minimum rules — immutable, cannot be deleted by custom workflows.

Architecture §5.3: effective_rules = SYSTEM_MINIMUM ∪ project_hard_rules.
Architecture §9.2: 系统最低节点显示锁定图标，删除操作不可用。
"""

from typing import Any

# ── 不可变的系统最低规则 ────────────────────────────────

SYSTEM_MINIMUM_RULES: dict[str, Any] = {
    # 代码变更路由必须包含这些节点
    "code_changed_requires": [
        "COMPILE",
        "UNIT_TEST",
        "EVIDENCE_CAPTURE",
    ],
    # HIGH 风险必须包含这些人工确认节点
    "high_risk_requires": [
        "REQUIREMENT_CONFIRMATION",
        "SOLUTION_CONFIRMATION",
        "PRE_MORTEM",
        "ACCEPTANCE_CONFIRMATION",
    ],
    # HIGH 或 DEPLOYMENT 必须包含预发布和接口测试
    "high_or_deployment_requires": [
        "PRERELEASE_DEPLOYMENT",
        "INTERFACE_TEST",
    ],
    # intent 和 risk 只能由用户在创建 Run 时指定，Desktop 和执行器不得覆盖
    "immutable_fields": ["intent", "risk"],
    # G3-G8 只能由 verifier 权限域写入
    "verifier_only_gates": [
        "G3_COMPILE",
        "G4_UNIT_TEST",
        "G5_ATDD",
        "G6_EVIDENCE",
        "G7_PRERELEASE",
        "G8_ACCEPTANCE",
    ],
    # 所有阶段产物必须写入 state.phase_dir
    "artifact_must_be_in_phase_dir": True,
    # Gate 失败按 failure_recovery.gate_to_node 回退；超过 2 次进入 BLOCKED
    "max_auto_retries_per_gate": 2,
    # KNOWLEDGE_PROMOTION 只生成候选草稿；写入长期知识库必须人工 review/accept
    "knowledge_promotion_requires_review": True,
}


def get_effective_rules(project_hard_rules: dict[str, Any]) -> dict[str, Any]:
    """Merge system minimum rules with project hard rules.

    Architecture §3.3: effective_rules = system_minimum ∪ project_hard.
    Project rules can be stricter but never weaker.
    """
    effective: dict[str, Any] = {}

    # List-typed rules: union
    for key in ["code_changed_requires", "high_risk_requires",
                "high_or_deployment_requires", "verifier_only_gates"]:
        system = SYSTEM_MINIMUM_RULES.get(key, [])
        project = project_hard_rules.get(key, [])
        effective[key] = list(set(system) | set(project))

    # Scalar rules: system default, project can override to stricter
    for key in ["max_auto_retries_per_gate"]:
        system_val = SYSTEM_MINIMUM_RULES.get(key)
        project_val = project_hard_rules.get(key)
        if project_val is not None:
            # For retry limits: lower is stricter
            effective[key] = min(system_val, project_val) if isinstance(system_val, int) else project_val
        else:
            effective[key] = system_val

    # Boolean rules: OR (either flag enables)
    for key in ["artifact_must_be_in_phase_dir", "knowledge_promotion_requires_review"]:
        effective[key] = SYSTEM_MINIMUM_RULES.get(key, False) or project_hard_rules.get(key, False)

    # Preserve immutable fields
    effective["immutable_fields"] = list(SYSTEM_MINIMUM_RULES.get("immutable_fields", []))

    return effective
