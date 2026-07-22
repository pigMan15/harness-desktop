# 方案设计

## 现状上下文

- Artifact Service 当前提供安全读取和列表能力，但没有 `watcher.py`。
- Approval 目录当前只有 `policy.py`，缺少可被 Runtime/API 复用的服务层。
- Renderer 没有测试文件，导致 `pnpm --filter @harness/renderer test` 返回 `No test files found`。
- Playwright 配置已存在，但 `tests/e2e/` 目录缺失。

## 推荐方案

1. Artifact watcher：
   - 新增 `runtime/src/harness_runtime/artifacts/watcher.py`。
   - 实现无依赖的 snapshot/diff 轮询工具，输出 `created/modified/deleted` 事件。
   - 不自动修改 state，不启动后台线程。
2. Approval Service：
   - 新增 `runtime/src/harness_runtime/approvals/service.py`。
   - 复用 `policy.classify_request/is_forbidden/requires_second_confirmation`。
   - 生成审批请求、校验决策、要求危险操作二次确认、可选记录 audit event。
3. Renderer 测试：
   - 新增 `apps/renderer/vitest.config.ts`。
   - 新增 `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts` 覆盖 store add/reorder/undo/redo。
   - 新增 `apps/renderer/src/features/execution/ExecutionPage.test.ts` 做源码级安全/文案约束测试，避免 jsdom/testing-library 新依赖。
4. E2E baseline：
   - 新增 `tests/e2e/project-import.spec.ts` 和基础 smoke 测试。
   - 优先覆盖静态 renderer HTML/入口资产存在性；不宣称安装/真实 Runtime/Codex 完成。
5. 测试配置：
   - 调整 `vitest.workspace.ts` 明确只加载存在的 package config，避免扫描 runtime cache。

## 受影响文件/模块

- `runtime/src/harness_runtime/artifacts/watcher.py`
- `runtime/tests/artifacts/test_watcher.py`
- `runtime/src/harness_runtime/approvals/service.py`
- `runtime/tests/approvals/test_service.py`
- `apps/renderer/vitest.config.ts`
- `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`
- `apps/renderer/src/features/execution/ExecutionPage.test.ts`
- `tests/e2e/project-import.spec.ts`
- `vitest.workspace.ts`
- 相关文档/phase 产物

## 数据流

```text
phase_dir snapshot
  -> ArtifactWatcher.scan()
  -> ArtifactChanged-style event records

tool call
  -> ApprovalService.create_request()
  -> policy classification / forbidden prefix / second confirmation
  -> ApprovalService.resolve()
  -> optional audit record
```

## 兼容性

- Artifact watcher 是新增模块，不改变 `read_artifact/list_artifacts` 现有行为。
- Approval Service 复用现有 policy，不削弱已有约束。
- Renderer 测试新增配置不影响构建入口。
- E2E baseline 只增加测试文件，不改变运行时代码。

## 回滚

- Python 新模块与测试可单文件回滚。
- Renderer 测试/配置如影响 `pnpm test`，可先回退配置再定位。
- 若 Python 环境仍不可用，不把 pytest 标记为 PASS，记录 BLOCKED/WAIVED。

## 被拒绝的替代方案

- 引入 watchdog 或 testing-library：当前仓库未声明依赖，新增网络/依赖风险过高。
- 直接把 watcher 接入长期后台任务：会扩大运行时生命周期和事件总线范围。
- 写“假 E2E”宣称完整发布验收：违反上轮验证边界。
