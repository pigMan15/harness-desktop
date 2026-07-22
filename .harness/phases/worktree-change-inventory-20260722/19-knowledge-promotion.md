# 工作区变更清单

## 来源

- RunId: worktree-change-inventory-20260722
- Intent: QUERY
- Risk: NA
- Phase dir: `.harness/phases/worktree-change-inventory-20260722`
- 目标：将当前 dirty worktree 按来源 run 和模块拆分，形成后续 staging/commit 计划。

## 当前概况

- 已跟踪修改：14 个文件。
- 未跟踪文件/目录：包含 4 组 harness run 产物、docs、新增测试、runtime 新模块、E2E 文件和若干配置。
- 当前 active `.harness/state.json` 已指向本 inventory run。

## 建议提交批次

| 批次 | 建议主题 | 文件 | 来源/说明 |
| --- | --- | --- | --- |
| 1 | `docs: align desktop documentation with implementation` | `README.md`, `README_en.md`, `doc/desktop-implementation-plan.md`, `docs/user-guide.md`, `docs/workflow-studio.md`, `docs/troubleshooting.md`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`, `apps/renderer/src/app/App.tsx`, `apps/renderer/src/features/execution/ExecutionPage.tsx` | 来自 `doc-implementation-alignment-20260722`。包含文档补齐、README 英文重写、少量类型/安全清理。 |
| 2 | `feat(runtime): add artifact watcher and approval service` | `runtime/src/harness_runtime/artifacts/watcher.py`, `runtime/tests/artifacts/test_watcher.py`, `runtime/src/harness_runtime/approvals/service.py`, `runtime/tests/approvals/test_service.py` | 来自 `doc-diff-feature-completion-20260722` 的 D13/D14。 |
| 3 | `test: add renderer and contract test baselines` | `apps/renderer/vitest.config.ts`, `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`, `apps/renderer/src/features/execution/ExecutionPage.test.ts`, `apps/desktop/vitest.config.ts`, `packages/contracts/vitest.config.ts`, `vitest.workspace.ts`, `package.json`, `pnpm-lock.yaml` | 来自 `doc-diff-feature-completion-20260722` 的 D15，并包含根 `pnpm test` 脚本调整与依赖锁更新。 |
| 4 | `test(e2e): add Playwright baseline and system browser fallback` | `tests/e2e/project-import.spec.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml` | E2E baseline 来自 `doc-diff-feature-completion-20260722`；`playwright.config.ts` fallback 来自 `e2e-browser-verification-20260722`。`package.json/pnpm-lock.yaml` 与批次 3 重叠，提交时需要用交互式/按 hunk staging 拆分或合并批次 3+4。 |
| 5 | `chore(harness): archive completed run evidence` | `.harness/phases/doc-implementation-alignment-20260722/`, `.harness/runs/doc-implementation-alignment-20260722/`, `.harness/phases/doc-diff-feature-completion-20260722/`, `.harness/runs/doc-diff-feature-completion-20260722/`, `.harness/phases/e2e-browser-verification-20260722/`, `.harness/runs/e2e-browser-verification-20260722/`, `.harness/phases/worktree-change-inventory-20260722/`, `.harness/runs/worktree-change-inventory-20260722/`, `.harness/state.json` | 归档本次连续工作的审计证据。注意 `.harness/state.json` 是当前 active run 状态，适合最后与 evidence 一起提交。 |

## 需确认来源的变更

| 文件 | 当前观察 | 建议 |
| --- | --- | --- |
| `.harness/workflow.yaml` | 从单字符 `x` 变成完整 workflow 定义，未出现在本轮 evidence 的 changed_files 中。 | 单独确认是否属于 harness 修复/初始化；不要混入业务功能提交。 |
| `.npmrc` | 未跟踪，内容为 `block-exotic-subdeps=false` 和 `node-linker=hoisted`。 | 与 pnpm 安装策略相关；可与包装/依赖环境提交放一起，但需确认团队是否接受降低 exotic subdep 阻断。 |
| `pnpm-workspace.yaml` | 新增 `nodeLinker: hoisted`，允许 `electron` 和 `electron-winstaller` build。 | 看起来属于 Electron packaging 依赖环境；建议和 `desktop-package-20260722` 或依赖环境批次单独提交。 |
| `.harness/phases/desktop-package-20260722/`, `.harness/runs/desktop-package-20260722/` | run 状态仍是 `IN_PROGRESS / DEPLOYMENT / MEDIUM / PRE_MORTEM`。 | 暂不并入完成类提交；可以后续继续该 packaging run 或单独标记为中断记录。 |

## 不建议立即提交的内容

- 不建议把 `desktop-package-20260722` 与已完成的功能/E2E run 混在一个 commit。
- 不建议把 `.harness/workflow.yaml` 的大修与 runtime/renderer 功能变更混在一起。
- 不建议在未确认 `.npmrc` 安全策略前，把它悄悄并入测试或功能提交。

## 建议下一步

1. 先确认 `.harness/workflow.yaml`、`.npmrc`、`pnpm-workspace.yaml` 是否保留。
2. 若保留，按上面的 5 个批次 staging；`package.json` 和 `pnpm-lock.yaml` 需要按 hunk 拆，或者把测试/E2E 依赖批次合并为一个提交。
3. 完成 staging 后再运行一次 `pnpm typecheck`、`pnpm test`、以及系统 Chrome fallback 的 `pnpm test:e2e`，再提交。
