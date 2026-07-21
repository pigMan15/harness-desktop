# 需求确认 — Harness Desktop State Machine (Phase 2)

节点：REQUIREMENT_CONFIRMATION　角色：orchestrator　产物：`02-requirement-confirmation.md`
上游：`01-requirement-review.md`（G1=PASS）　门禁：G1_REQUIREMENTS（已PASS）

## 确认人：用户 ✓

## 确认内容

- Phase 2 范围：5 子系统 8 Tasks ✓
- 7 条可观察验收标准 ✓

## 开放问题决策

| ID | 决策 |
|---|---|
| OQ-1 | SQLite 开发阶段放项目根 `harness-desktop.db`（加入 `.gitignore`），Phase 6 迁 AppData |
| OQ-2 | YAML 首发不支持 `!include`/anchor/alias，只纯 YAML/JSON |
| OQ-3 | CHANGE_REQUEST M2 先做 API+测试，UI 留 Phase 4 |

## 下一步

SOLUTION_DESIGN（tech-architect）→ 产出 `03-solution-design.md`（Phase 2 5 子系统技术方案）
