# 开发记录

## 问题定位

- `.workspace-shell` 与 `.page-scroll` 是固定 `100vh` 应用 Grid 的嵌套子项，但缺少 `min-height: 0`。
- `.terminal-page` 同时使用 `height: 100%` 和 `minmax(320px, 1fr)`，`.terminal-host` 又声明 `min-height: 320px`；xterm fit 改写内部尺寸时，内容最小高度可重新参与父级滚动布局。
- ResizeObserver 每次回调都向 Main 发送 cols/rows，即使 fit 后行列未变化，放大空闲反馈和无效 IPC。

## 实现

- `apps/renderer/src/app/styles.css`
  - 为 workspace/page scroll Grid 子项增加 `min-height: 0`。
  - Terminal 页面改为有界、可收缩的 `minmax(0, 1fr)` 行并隐藏溢出。
  - Terminal host/xterm 使用 `min-height: 0; height: 100%`，由父 Grid 决定稳定高度。
- `apps/renderer/src/features/terminal/TerminalPage.tsx`
  - 记录最近一次同步的 cols/rows，仅实际变化时调用 `resizeTerminal`。
  - 中文注释说明 xterm DOM 与 ResizeObserver 反馈风险。
- `apps/renderer/src/features/terminal/TerminalPage.test.ts`
  - 实现后补充布局边界和 resize 去重源契约测试；未采用 TDD Red/Green。
- `tests/e2e/multirun-terminal-workflow.spec.ts`
  - 实现后补充空闲 Terminal 的 page/host/xterm viewport 连续高度采样。

## 用户覆盖

- 用户明确要求跳过 TDD 和编译；没有运行修复前失败测试、typecheck 或生产 build。
- COMPILE/G3 由 verifier 记录为用户授权 `WAIVED`，不得标记为 PASS。
- G4 未被豁免，移交 verifier 运行既有 Renderer 单元测试；浏览器布局场景作为验收补充证据。

## 注释范围

- `TerminalPage.tsx` ResizeObserver 回调中的中文注释解释为何必须按真实行列变化去重，而不是复述赋值动作。

## 回滚

- 回退上述四个 Renderer/测试文件即可；无协议、数据库、Runtime、PTY 或用户数据变更。
