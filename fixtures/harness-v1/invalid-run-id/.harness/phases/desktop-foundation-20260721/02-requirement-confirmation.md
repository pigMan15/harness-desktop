# 需求确认 — Harness Desktop Foundation (M1)

节点：REQUIREMENT_CONFIRMATION　角色：orchestrator　产物：`02-requirement-confirmation.md`
上游：`01-requirement-review.md`（G1=PASS）
门禁：G1_REQUIREMENTS（已 PASS，本节点人工确认后不重评）

## 确认人

用户（orchestrator 角色要求人工确认，已满足）。

## 确认内容

用户已审阅并接受 `01-requirement-review.md` 中定义的需求范围与验收标准：

- **目标**：交付 M1 — 安全 Electron 壳可启动认证 Python Runtime，`.harness` v1.0 兼容。
- **范围**：Phase 0（仓库+CI 基线）+ Phase 1（v1 fixture、RPC 契约、Runtime 健康认证、Electron 安全壳）。
- **6 条可观察验收标准**：均已确认，覆盖仓库基线、CI 阻断验证、fixture 分类、RPC 契约同源校验、认证握手拒绝/成功、安全壳隔离验证。

## 开放问题决策

| # | 问题 | 用户决策 |
|---|---|---|
| OQ-1 | Python 版本：计划 `<3.13`，本机仅 3.13.6 | **放宽到 `>=3.11`**（用 3.13）。`pyproject.toml` 设 `>=3.11`，Phase 6 PyInstaller 打包时再评估是否需降级到 3.12。 |
| OQ-2 | Git 仓库与远端 | 当前非 git 仓库 → `git init` + 创建开发分支；暂无远端但后续准备推送 GitHub。本次先本地 init + 分支，CI 配置写入但暂以本地校验为主。 |
| OQ-3 | Fixture provenance（架构 §17） | 以本仓库 `.harness/` 为初始 fixture 基线，冻结到 `fixtures/harness-v1/` 并记录内容哈希。后续 CI 审核更新时做显式哈希对比。 |
| OQ-4 | M1 是否依赖真实 Codex | **不依赖**。M1 只做 Runtime 握手与 Electron 壳；Codex Adapter 属 Phase 4，M1 预留 Executor 接口即可。 |
| OQ-5 | M1 是否涉及签名/安装包 | **不涉及**。签名/安装包属 Phase 6；CI 无凭证只产 unsigned artifact。 |

## 进度状态

- G1_REQUIREMENTS = PASS（REQUIREMENT_REVIEW 已通过，人工确认已满足）
- 下一节点：SOLUTION_DESIGN（tech-architect）→ 产出 `03-solution-design.md`（G2_DESIGN 门禁，但 G2 的全部所需产物含 03+06，预计在 IMPLEMENTATION_PLAN 完成后评估）
