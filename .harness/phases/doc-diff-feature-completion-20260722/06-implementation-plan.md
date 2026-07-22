# 实施计划

## 目标

补齐差异清单 D13-D16 的仓库内功能/测试缺口，并留下可验证证据。

## 假设

- 不新增第三方依赖。
- Python 测试环境可能不可用，需先探测再记录。
- 本次不完成发布级外部验证。

## 任务列表

1. 新增 Artifact watcher 与测试。
   - 文件：`runtime/src/harness_runtime/artifacts/watcher.py`, `runtime/tests/artifacts/test_watcher.py`
   - 验证：artifact pytest 或等价静态检查。
2. 新增 Approval Service 与测试。
   - 文件：`runtime/src/harness_runtime/approvals/service.py`, `runtime/tests/approvals/test_service.py`
   - 验证：approval pytest 或等价静态检查。
3. 新增 renderer 测试。
   - 文件：`apps/renderer/vitest.config.ts`, `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`, `apps/renderer/src/features/execution/ExecutionPage.test.ts`
   - 验证：`pnpm --filter @harness/renderer test`。
4. 新增 E2E baseline。
   - 文件：`tests/e2e/project-import.spec.ts`
   - 验证：可行时 `pnpm test:e2e -- --list` 或聚焦 E2E。
5. 修正 workspace 测试配置。
   - 文件：`vitest.workspace.ts`
   - 验证：`pnpm test` 不再扫描 runtime cache。

## 验证计划

- `pnpm typecheck`
- `pnpm --filter @harness/renderer test`
- `pnpm --filter @harness/desktop test`
- `pnpm --filter @harness/contracts test`
- `pnpm test`
- Python 可用时运行 `python -m pytest runtime/tests/artifacts runtime/tests/approvals -q`

## 回滚计划

- 任一新增模块失败时，回退对应模块和测试，保留其他通过改动。
- 不将环境不可用记录为功能成功。

## TDD 记录

- 新增或选中的测试：计划先写 watcher/service/renderer/E2E 测试，再实现缺口。
- 初始失败：待 DEVELOPMENT 阶段执行。
- 实现：待 DEVELOPMENT 阶段执行。
- 聚焦结果：待 verifier 阶段记录。
- 扩展结果：待 verifier 阶段记录。
