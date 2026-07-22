# Staging 结果记录

## 来源

- RunId: worktree-staging-20260722
- Intent: QUERY
- Risk: NA
- Phase dir: `.harness/phases/worktree-staging-20260722`

## 已暂存范围

已执行 `git add`，暂存以下已确认范围：

- 文档对齐与用户文档：`README.md`, `README_en.md`, `doc/desktop-implementation-plan.md`, `docs/`
- 桌面/渲染端小修与测试配置：`apps/desktop/*`, `apps/renderer/*`, `packages/contracts/vitest.config.ts`
- Runtime 新模块与测试：`runtime/src/harness_runtime/artifacts/watcher.py`, `runtime/src/harness_runtime/approvals/service.py`, 对应 tests
- E2E baseline 与 Playwright fallback：`tests/e2e/project-import.spec.ts`, `playwright.config.ts`
- 依赖与 workspace 配置：`.npmrc`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vitest.workspace.ts`
- 已完成 run 的 harness 证据：`doc-implementation-alignment-20260722`, `doc-diff-feature-completion-20260722`, `e2e-browser-verification-20260722`, `worktree-change-inventory-20260722`, `worktree-staging-20260722`
- `.harness/workflow.yaml` 与当前 `.harness/state.json`

## 未暂存范围

- `.harness/phases/desktop-package-20260722/`
- `.harness/runs/desktop-package-20260722/`

原因：该 run 仍处于 `IN_PROGRESS / DEPLOYMENT / MEDIUM / PRE_MORTEM`，不应混入已完成工作提交。

## 当前 index 摘要

- 暂存文件数：75 个。
- 暂存统计：约 8025 行新增、806 行删除。
- 未暂存/未跟踪剩余：仅 `desktop-package-20260722` 相关目录。

## 后续建议

- 如要保持提交粒度，下一步应按批次 commit；但因为当前 index 已整体暂存，若要拆成多 commit，需要先按路径或 hunk 调整 index。
- 若接受一次性提交，可直接创建一个聚合提交，提交信息建议覆盖 docs/runtime/tests/e2e/harness evidence。
