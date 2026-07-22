# 开发记录

## 变更文件

- `apps/renderer/src/app/App.tsx`
- `apps/renderer/src/features/execution/ExecutionPage.tsx`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `README.md`
- `README_en.md`
- `doc/desktop-implementation-plan.md`
- `docs/user-guide.md`
- `docs/workflow-studio.md`
- `docs/troubleshooting.md`
- `.harness/phases/doc-implementation-alignment-20260722/20-doc-implementation-diff.md`

## 变更说明

- 补齐 `window.harness` 类型中的 `diffWorkflow` 和 `applyWorkflow`，与 preload 暴露 API 及 Workflow 页面调用保持一致。
- 移除 Execution 页面未使用的 `useCallback` 导入，修复 `noUnusedLocals` typecheck 失败。
- 移除 Electron Main 中未使用的 `execSync` 导入，避免 `noUnusedLocals` 下的 typecheck 风险。
- 将 preload 事件 allowlist 常量命名为 `VALID_EVENT_CHANNELS`，与安全测试和可读性要求一致。
- 将英文 README 从 Bridle CLI 文档改为 Harness Desktop 当前实现说明。
- 新增当前用户可用的用户指南、Workflow Studio 指南和故障排查文档。
- 在中文 README 和实施计划中明确发布级验证边界，避免把不可证明事项表达为已完成。
- 输出设计文档与实现差异清单，记录已处理差异和剩余缺口。

## 中文注释范围

- 本次源码改动仅补类型声明和移除未使用导入，没有新增核心业务逻辑；未新增中文代码注释。

## TDD 记录

- 新增或选中的测试：现有 TypeScript typecheck、Vitest、pytest。
- 初始失败：`pnpm typecheck` 发现 `ExecutionPage.tsx` 存在未使用的 `useCallback` 导入。
- 实现：完成文档补齐和小范围 TypeScript 静态检查修复。
- 聚焦结果：待 verifier 阶段运行。
- 扩展结果：待 verifier 阶段运行。
