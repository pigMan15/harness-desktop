# 文档设计与实现差异清单

## 范围

- 设计来源：`doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`
- 当前说明来源：`README.md`, `README_en.md`
- 实现证据：`runtime/src/harness_runtime/**`, `runtime/tests/**`, `apps/desktop/**`, `apps/renderer/**`, `packages/contracts/**`, `schemas/**`, `scripts/**`

## 分类说明

- `OK`：设计项已有实现或测试证据。
- `DOC_STALE`：实现已有，但文档/计划状态滞后或错误。
- `IMPLEMENTATION_GAP`：设计要求有明确实现，但当前仓库缺失。
- `UNVERIFIED`：仓库内有部分实现或脚本，但缺少外部/端到端证据。

## 清单

| ID | 分类 | 设计/文档项 | 当前实现证据 | 差异与处理 |
| --- | --- | --- | --- | --- |
| D01 | OK | Runtime 是 `.harness` 业务写入入口，提供协议、Run、Workflow、Gate、Artifact、Recovery、Knowledge 等服务。 | `runtime/src/harness_runtime/api/app.py`, `protocol/*`, `runs/service.py`, `workflow/*`, `gates/*`, `artifacts/service.py`, `recovery/service.py`, `knowledge/service.py` | 核心模块存在，后续以测试命令验证。 |
| D02 | OK | Renderer 通过 typed preload API 访问 Runtime。 | `apps/desktop/src/preload/index.ts`, `apps/renderer/src/app/App.tsx` | Preload 暴露业务 API；本次补齐 `diffWorkflow/applyWorkflow` 类型声明。 |
| D03 | OK | Electron Main 启用 `contextIsolation`、关闭 `nodeIntegration`、启用 sandbox。 | `apps/desktop/src/main/index.ts`, `apps/desktop/tests/security.test.ts` | 配置与安全测试存在；本次移除未使用 `execSync` 导入，减少误导和 typecheck 风险。 |
| D04 | OK | Workflow Compiler 合并系统最低规则并支持模拟。 | `runtime/src/harness_runtime/workflow/compiler.py`, `system_policy.py`, `runtime/tests/workflow/test_compiler.py` | 有源码与聚焦测试。 |
| D05 | OK | Run Service 只接受用户提供 Intent/Risk 并冻结 required_nodes。 | `runtime/src/harness_runtime/runs/service.py`, `runtime/tests/runs/test_run_service.py` | 有源码与聚焦测试。 |
| D06 | OK | Gate Engine 执行产物存在性、Evidence 结构、权限和 retry/block 规则。 | `runtime/src/harness_runtime/gates/engine.py`, `permissions.py`, `runtime/tests/gates/test_gate_engine.py` | 有源码与聚焦测试。 |
| D07 | OK | Workflow Draft/Version/ZIP 导入导出包含 Zip Slip 防护。 | `runtime/src/harness_runtime/workflow/drafts.py`, `versioning.py`, `zip_io.py`, `runtime/tests/workflow/test_drafts.py`, `test_zip_io.py` | 有源码与测试。 |
| D08 | OK | Codex/Fake Executor 基础能力存在，Codex 缺失要有诊断。 | `runtime/src/harness_runtime/executors/base.py`, `fake.py`, `codex/*`, `runtime/tests/executors/**` | 有适配器和测试；真实 Codex smoke 仍见 D18。 |
| D09 | OK | Approval policy 分类高风险动作并限制通用前缀。 | `runtime/src/harness_runtime/approvals/policy.py`, `runtime/tests/approvals/test_policy.py` | Policy 层存在。设计计划中的 service 文件缺失见 D14。 |
| D10 | DOC_STALE | 英文 README 应描述 Harness Desktop。 | 原 `README_en.md` 内容是 Bridle CLI / `harness_cli`。 | 已改为 Harness Desktop 英文说明，补齐架构、快速开始、能力和验证边界。 |
| D11 | DOC_STALE | 实施计划 checkbox 与当前实现状态应可辨认。 | `doc/desktop-implementation-plan.md` 中所有任务仍为未勾选，但仓库已有 M1-M5 多数实现。 | 已新增“当前实现核对状态（2026-07-22）”段落，说明 checkbox 为原始计划结构，不再单独作为完成事实来源。 |
| D12 | DOC_STALE | README 文档入口应覆盖用户指南、Workflow Studio、故障排查。 | 原中文 README 只链接架构、实施计划、变更日志和 phase 产物。 | 已新增 `docs/user-guide.md`、`docs/workflow-studio.md`、`docs/troubleshooting.md` 链接和验证边界。 |
| D13 | IMPLEMENTATION_GAP | Artifact Service 计划包含文件监听 `runtime/src/harness_runtime/artifacts/watcher.py`。 | `runtime/src/harness_runtime/artifacts/service.py` 存在，`watcher.py` 不存在。 | 记录为缺口；未在本 run 内补监听器，以免扩大事件系统范围。 |
| D14 | IMPLEMENTATION_GAP | Approval Service 计划包含 `runtime/src/harness_runtime/approvals/service.py`。 | `approvals/policy.py` 存在，`service.py` 不存在。 | 记录为缺口；当前执行页面直接使用 Runtime execution/approval API。 |
| D15 | IMPLEMENTATION_GAP | Renderer Workflow Studio/Execution 计划包含组件级测试。 | `apps/renderer/src/features/workflow-studio/*`、`ExecutionPage.tsx` 存在；`apps/renderer/tests/workflow-studio.test.tsx` 和 `execution.test.tsx` 不存在。 | 记录为测试缺口。 |
| D16 | IMPLEMENTATION_GAP | Phase 7 计划包含 `tests/e2e/*.spec.ts`。 | `playwright.config.ts` 存在；`tests/e2e/` 不存在。 | 记录为 E2E 缺口，不能宣称完整 E2E 通过。 |
| D17 | DOC_STALE | 发布文档应覆盖导入、Run、Workflow Studio、审批、Gate、恢复、知识和诊断。 | `docs/` 目录此前不存在。 | 已新增三份当前实现版文档。 |
| D18 | UNVERIFIED | 首发验收要求真实 Codex smoke、Windows 安装/升级/卸载、诊断导出、签名和更新源。 | `runtime/harness-runtime.spec`, `scripts/package-runtime.ps1`, `scripts/package-desktop.ps1`, `apps/desktop/forge.config.ts` 存在。 | 仓库内有打包基础，但缺少干净 VM、签名、更新和真实 Codex 证据；已在 README/计划中标为验证边界。 |
| D19 | UNVERIFIED | README 声称 `python -m pytest runtime/tests -q # 176 tests`。 | `runtime/tests/**` 存在；当前 shell 无 `python`，bundled Python 无 `pytest`。 | 本 run 无法验证实际测试数量；已记录为剩余风险，不再扩大到环境安装。 |

## 本次已完善

- 修复英文 README 与项目实际不符的问题。
- 新增用户指南、Workflow Studio 指南和故障排查文档。
- 在实施计划中增加当前实现核对状态。
- 在中文 README 中补文档入口和发布级验证边界。
- 修复两个 TypeScript 类型/静态检查小问题。

## 剩余风险

- E2E、Windows VM、签名、更新源和真实 Codex smoke 需要外部环境或更大范围实现。
- 未勾选的历史计划仍保留，需以后逐任务回填或拆分为新的收尾 run。
