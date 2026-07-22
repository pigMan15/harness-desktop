# Context Pack

## 任务来源

- RunId: `doc-diff-feature-completion-20260722`
- PRD 标识: 差异清单功能补齐
- PRD 路径或 Wiki 页面: `.harness/phases/doc-implementation-alignment-20260722/20-doc-implementation-diff.md`
- 原型/截图: 无
- 发起人: 用户
- 时间: 2026-07-22

## 需求摘要

用户要求根据上一轮差异清单继续完善功能。本次聚焦仓库内可直接实现和验证的缺口：Artifact 文件监听、Approval Service、renderer Workflow Studio/Execution 测试、Playwright E2E 基线。发布级外部事项（Windows VM、签名、更新源、真实 Codex smoke）不在本 run 内伪造完成。验收方向是新增对应源码/测试文件，接入现有模块边界，并通过可用的 typecheck、Vitest 和 Python 测试。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| D13 | Artifact Service 计划包含 `runtime/src/harness_runtime/artifacts/watcher.py`，当前缺失。 | `20-doc-implementation-diff.md` |
| D14 | Approval Service 计划包含 `runtime/src/harness_runtime/approvals/service.py`，当前只有 policy。 | `20-doc-implementation-diff.md` |
| D15 | Renderer Workflow Studio/Execution 计划包含组件级测试，当前缺失。 | `20-doc-implementation-diff.md` |
| D16 | Phase 7 计划包含 `tests/e2e/*.spec.ts`，当前 `tests/e2e/` 缺失。 | `20-doc-implementation-diff.md` |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| pitfall | 发布级验证不能仅凭源码存在宣称完成。 | `doc-implementation-alignment-20260722/19-knowledge-promotion.md` |
| pitfall | `pnpm test` 曾因扫描 `runtime/.pytest_cache` EPERM 失败；需要考虑 workspace exclude 或聚焦测试。 | `doc-implementation-alignment-20260722/13-unit-test.md` |

## 相关代码锚点

- Artifact Service: `runtime/src/harness_runtime/artifacts/service.py`, `runtime/tests/artifacts/test_artifact_service.py`
- Approval Policy: `runtime/src/harness_runtime/approvals/policy.py`, `runtime/tests/approvals/test_policy.py`
- Runtime API/Execution: `runtime/src/harness_runtime/api/app.py`, `runtime/src/harness_runtime/executors/fake.py`
- Renderer: `apps/renderer/src/features/workflow-studio/*`, `apps/renderer/src/features/execution/ExecutionPage.tsx`
- Desktop preload/main: `apps/desktop/src/preload/index.ts`, `apps/desktop/src/main/index.ts`
- E2E config: `playwright.config.ts`
- Vitest config: `vitest.workspace.ts`, package test scripts

## 业务不变量

- Renderer 不直接访问 Node/Shell/文件系统。
- Approval Service 不得放宽危险命令、删除、部署和危险 Git 的二次确认约束。
- Artifact watcher 只报告授权目录内文件变化，不自动修改 state 或 gate。
- E2E baseline 不得把外部不可用场景伪装成通过。

## 待确认问题

- 当前目标以本地可验证功能为准；发布级外部验证继续作为后续 run。

## 风险判断

- 建议 Intent: FEATURE
- 建议 Risk: MEDIUM
- 风险理由: 涉及 Runtime、Renderer、测试和配置多个模块，但不涉及生产部署、数据迁移或真实认证系统。

## 知识来源

- Obsidian: 未使用
- LLM Wiki: 未使用
- Harness run: `doc-implementation-alignment-20260722`
- 代码文件: 上述锚点
