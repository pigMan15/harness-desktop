# 开发记录

## 变更文件

- `runtime/src/harness_runtime/artifacts/watcher.py`
- `runtime/tests/artifacts/test_watcher.py`
- `runtime/src/harness_runtime/approvals/service.py`
- `runtime/tests/approvals/test_service.py`
- `apps/renderer/vitest.config.ts`
- `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`
- `apps/renderer/src/features/execution/ExecutionPage.test.ts`
- `apps/desktop/vitest.config.ts`
- `packages/contracts/vitest.config.ts`
- `tests/e2e/project-import.spec.ts`
- `vitest.workspace.ts`
- `package.json`

## 变更说明

- 补齐 D13：新增 Artifact watcher，支持 phase_dir 产物快照和 `created/modified/deleted` 差异计算。
- 补齐 D14：新增 Approval Service，复用现有 policy，封装审批请求创建、决策解析、禁止前缀拦截、危险操作二次确认和可选审计回调。
- 补齐 D15：新增 renderer Vitest 配置和 2 个测试文件，覆盖 Workflow Draft store 与 Execution 页面审批约束。
- 补齐 D16：新增 `tests/e2e/project-import.spec.ts` 作为 Playwright E2E baseline，覆盖 fixture 存在和 renderer 静态入口。
- 修正 root `pnpm test` 脚本，改为递归执行包级测试，避免 Vitest workspace 在当前环境误收集 suite。

## 中文注释范围

- `runtime/src/harness_runtime/artifacts/watcher.py`：说明 watcher 只报告 phase_dir 内普通文件，避免符号链接逃逸被当成可信产物。
- `runtime/src/harness_runtime/approvals/service.py`：说明禁止前缀是系统底线，即使用户误点允许也不能放行。

## TDD 记录

- 新增或选中的测试：
  - `runtime/tests/artifacts/test_watcher.py`
  - `runtime/tests/approvals/test_service.py`
  - `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`
  - `apps/renderer/src/features/execution/ExecutionPage.test.ts`
  - `tests/e2e/project-import.spec.ts`
- 初始失败：
  - root `pnpm test` 初始因 Vitest workspace 模式未正确注册 suite 失败。
  - Playwright CLI 当前缺失，`pnpm exec playwright test --list` 不可运行。
- 实现：
  - 新增 watcher/service/test/config/e2e baseline。
  - 将 root `test` 脚本改为包级递归测试。
- 聚焦结果：
  - `pnpm typecheck` 通过。
  - `pnpm --filter @harness/renderer test` 通过。
  - `pnpm --filter @harness/desktop test` 通过。
  - `pnpm --filter @harness/contracts test` 通过。
  - bundled Python `py_compile` 和行为断言通过。
- 扩展结果：
  - `pnpm test` 通过。
  - Playwright CLI 缺失，E2E 仅完成 baseline 文件和配置，不宣称运行通过。
