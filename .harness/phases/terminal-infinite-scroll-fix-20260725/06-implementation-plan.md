# 实施计划

## 目标

让 Terminal 页面在空闲和窗口 resize 后都保持稳定的纵向尺寸，阻断外层 Grid、xterm FitAddon 与 ResizeObserver 之间的高度反馈，同时保留终端内部 scrollback 和真实 PTY resize。

## 假设

- 主要问题位于 Renderer：`.page-scroll` 的 Grid 子项缺少 `min-height: 0`，`.terminal-page` 的 `height: 100%` 与 `minmax(320px, 1fr)` 使内容尺寸参与父级滚动高度，xterm fit 后再次触发观察器。
- xterm `fit()` 在同一可用尺寸下可能多次触发 observer；即使布局稳定，也应按 cols/rows 去重 Main resize IPC。
- Runtime、Electron Main 和 node-pty 不需要变化。

## 任务列表

1. **建立隔离分支记录**
   - 从当前发布后提交创建 `codex/terminal-infinite-scroll-fix`，继续使用当前独立 Git worktree。
   - 记录 `09-branch.md` 和 `10-worktree.md`，不触碰主工作树的未提交文件。

2. **TDD Red：真实浏览器布局场景**
   - 编辑 `tests/e2e/multirun-terminal-workflow.spec.ts` 或新增聚焦 spec。
   - 复用 typed bridge，进入 `/terminal` 后连续采样 `.page-scroll`、`.terminal-host`、`.xterm-viewport` 的高度/scrollHeight。
   - 验证空闲稳定性、节点控制区可达和 resize 后稳定性；先运行场景确认修复前失败。

3. **TDD Red：resize 去重契约**
   - 编辑 `apps/renderer/src/features/terminal/TerminalPage.test.ts` 或抽取小型可测试 helper。
   - 要求仅在 cols/rows 改变时调用 `window.harness.resizeTerminal`，而不是每个 ResizeObserver 回调都调用。

4. **最小布局修复**
   - 编辑 `apps/renderer/src/app/styles.css`：为 `workspace-shell`、`page-scroll`、`terminal-page` 和 terminal Grid 行增加明确的 `min-height: 0`、稳定 overflow 与可收缩 track；保留窄窗口的可用最小尺寸策略。
   - 不使用基于 viewport 宽度的字体缩放，不改变现有视觉风格。

5. **最小观察器修复**
   - 编辑 `apps/renderer/src/features/terminal/TerminalPage.tsx`：fit 后比较上一次 cols/rows，只有实际变化且 session 存在时同步 Main。
   - cleanup 清理 observer、animation frame 和尺寸缓存，不引入定时轮询。

6. **验证与证据**
   - 聚焦 Renderer 单测。
   - `pnpm.cmd --filter @harness/renderer typecheck`。
   - 系统 Chrome 执行聚焦 Playwright 稳定性场景，随后执行相关 E2E 集合。
   - 记录 G3/G4/G6 命令、结果和浏览器测量值。

## 验证计划

- Red：`pnpm.cmd test:e2e -- --grep "terminal height remains stable" --reporter=line` 必须因高度持续变化失败。
- Green：同一聚焦场景通过，连续采样最大高度差不超过 1 CSS px。
- 单元：`pnpm.cmd --filter @harness/renderer test`。
- 类型：`pnpm.cmd --filter @harness/renderer typecheck`。
- 扩展：`pnpm.cmd test:e2e -- --reporter=line`，确认多 Run Terminal 与 Workflow Studio 场景不回归。

## 回滚计划

- 回退 Renderer CSS、TerminalPage observer 去重和新增测试提交即可；不涉及数据库、Run snapshot、PTY session schema 或用户项目数据迁移。
- 如果可收缩 Grid 在极小窗口导致终端不可用，保留 observer 去重并将终端最小高度调整为有界 `min()`/媒体查询，而不恢复无边界父级高度反馈。

## 用户覆盖（2026-07-25）

- 跳过 TDD：不先运行失败场景，不采用 Red/Green 顺序；回归测试可在实现后补充。
- 跳过编译：不运行 typecheck 或生产 build；COMPILE/G3 以用户授权豁免记录，不删除流程节点。
- 仍执行既有 Renderer 单元测试和最小运行态布局核对，以满足未被豁免的 G4 与验收证据要求。
