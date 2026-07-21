# Dispatcher 决策 — INTAKE (Phase 3)

- **意图**：FEATURE（Workflow Studio 可视化编辑器）
- **风险**：HIGH
- **当前节点**：INTAKE
- **下一节点**：CONTEXT_PACK
- **下一角色**：requirement-analyst
- **原因**：用户要求继续开发。M1+M2 已完成 Runtime 核心状态机。本 Run 构建 Workflow Studio（实施计划 Task 4.1+4.2）：可视化编辑自定义线性 Workflow、编译检查、语义 diff、版本历史、ZIP 导入导出。

## 任务摘要

**目标**：在 M2 Runtime（Protocol Adapter + Workflow Compiler + State Store + Run Service + Dispatcher）上实现 Workflow Studio。

**范围**：
- Task 4.1：Workflow Draft & Version Service — SQLite 草稿存储、compile 检查、semantic diff、apply（atomic lock + hash check）、版本历史、ZIP 导入导出（防 Zip Slip/symlink 逃逸）
- Task 4.2：Workflow Studio UI — React Flow 画布、Node Catalog 拖拽、Route Editor（按 Intent/Risk）、DiagnosticsPanel、系统最低节点锁定、保存前 compile→diff→二次确认

**非目标**：Codex Adapter（Phase 4）、审批服务、多 Agent 编排

**参考**：M1+M2 全部产物、`doc/desktop-implementation-plan.md` §Task 4.1-4.2、`doc/desktop-architecture.md` §9 自定义编排架构
