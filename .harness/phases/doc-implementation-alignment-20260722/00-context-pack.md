# Context Pack

## 任务来源

- RunId: `doc-implementation-alignment-20260722`
- PRD 标识: Harness Desktop doc/implementation alignment
- PRD 路径或 Wiki 页面: `doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`
- 原型/截图: 无
- 发起人: 用户
- 时间: 2026-07-22

## 需求摘要

本次任务要求核对当前项目整体实现与 `doc` 中设计文档的差异，输出可追溯清单，并对能在当前仓库内直接完善的差异进行修复。目标不是重新设计产品，而是让实现、文档和可验证状态对齐。核对范围覆盖 Python Runtime、Electron Main/Preload、React Renderer、共享契约、脚本、测试和 README/设计计划。验收方向是：差异有清单，变更有记录，相关验证命令有证据，剩余未完成项不被伪装成已完成。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| `.harness` v1.0 是权威协议 | `.harness/state.json` 是当前活动 Run 唯一事实源；阶段产物只能写入 `state.phase_dir`；snapshot 写入 `runs/<run-id>/state.json`。 | `doc/desktop-architecture.md` §3.1 |
| Runtime 是业务写入入口 | Renderer/Main/执行器不得绕过 Runtime 直接修改权威状态。 | `doc/desktop-architecture.md` §2, §8 |
| 首发路线 | 设计分为协议骨架、状态机与门禁、Workflow Studio、Codex/审批、知识与发布、E2E 验收。 | `doc/desktop-implementation-plan.md` |
| 当前 README 宣称进度 | README 表示 M1-M5 已交付，pytest 176，功能覆盖 Runtime/Workflow/Gate/Codex/Recovery/Knowledge。 | `README.md` |
| 实施计划状态滞后风险 | `desktop-implementation-plan.md` 使用大量未勾选任务，即使实现存在，也会让 doc 读者判断为未完成。 | `doc/desktop-implementation-plan.md` |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| decision | 本 run 使用 FEATURE/MEDIUM，因为用户要求“完善”，可能产生跨文件修改。 | `.harness/phases/doc-implementation-alignment-20260722/00-intake.md` |
| pitfall | 不能把旧 `desktop-package-20260722` deployment run 混用为本任务。 | `.harness/state.json` 先前状态 |

## 相关代码锚点

- Runtime API: `runtime/src/harness_runtime/api/app.py`, `runtime/src/harness_runtime/api/auth.py`
- Protocol: `runtime/src/harness_runtime/protocol/models.py`, `loader.py`, `validator.py`
- Workflow: `runtime/src/harness_runtime/workflow/compiler.py`, `dispatcher.py`, `drafts.py`, `versioning.py`, `system_policy.py`
- Runs/Gates/Artifacts: `runtime/src/harness_runtime/runs/service.py`, `runtime/src/harness_runtime/gates/engine.py`, `runtime/src/harness_runtime/artifacts/service.py`
- Persistence/Recovery/Audit: `runtime/src/harness_runtime/persistence/*`, `runtime/src/harness_runtime/recovery/service.py`
- Executors/Approvals/Knowledge: `runtime/src/harness_runtime/executors/*`, `runtime/src/harness_runtime/approvals/policy.py`, `runtime/src/harness_runtime/knowledge/service.py`
- Desktop shell: `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/runtime-supervisor.ts`, `apps/desktop/src/preload/index.ts`
- Renderer pages: `apps/renderer/src/features/*`, `apps/renderer/src/app/App.tsx`
- Contracts: `packages/contracts/src/rpc.ts`, `schemas/rpc.schema.json`, `schemas/state.schema.json`
- Tests: `runtime/tests/**`, `apps/desktop/tests/security.test.ts`, `packages/contracts/tests/rpc.test.ts`, `playwright.config.ts`

## 业务不变量

- 不得削弱 `.harness` v1.0 约束：节点不可跳过，phase artifact 必须写入 `state.phase_dir`。
- 不得把未验证或未实现内容改写成“已完成”。
- 文档完善应优先消除误导、补齐差异和验收证据，而不是扩大产品范围。
- 如修改源码，必须经过 COMPILE、UNIT_TEST、EVIDENCE_CAPTURE。

## 待确认问题

- “doc 中设计文档”当前按 `doc/desktop-architecture.md` 和 `doc/desktop-implementation-plan.md` 解释。
- 对大型未完成首发项，如 Playwright E2E、Windows VM RC、安装升级卸载，若当前仓库无法证明完成，应记录为剩余差异，不伪造通过。

## 风险判断

- 建议 Intent: FEATURE
- 建议 Risk: MEDIUM
- 风险理由: 跨文档、Runtime、桌面端、Renderer 和测试核对，可能产生源码或文档修复，但不涉及数据迁移、认证生产系统或部署。

## 知识来源

- Obsidian: 未使用
- LLM Wiki: 未使用
- Harness run: `doc-implementation-alignment-20260722`
- 代码文件: `rg --files` 扫描结果和上述代码锚点
