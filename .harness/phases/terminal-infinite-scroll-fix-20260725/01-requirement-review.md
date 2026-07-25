# 需求评审

## 目标

修复 Terminal 页面在用户不操作时持续增加纵向高度和滚动范围的问题，使终端工作区稳定受应用可视区域约束，同时保留 xterm 自身 scrollback、窗口 resize 和 PTY cols/rows 同步。

## 范围

- 修正 `.workspace-shell`、`.page-scroll`、`.terminal-page` 和 `.terminal-host` 的尺寸约束，使嵌套 Grid/Flex 子项可以在固定 viewport 内收缩。
- 消除 FitAddon、xterm DOM 高度和 ResizeObserver 之间的自激反馈循环。
- 仅在终端实际 cols/rows 变化时向 Main 发送 resize，避免空闲状态重复 IPC。
- 增加空闲高度稳定性和 resize 去重的回归覆盖。

## 非目标

- 不修改 node-pty、TerminalManager、Run/worktree 或 Workflow 协议。
- 不改变 xterm 的 5000 行内部 scrollback 能力。
- 不重新设计 Terminal 工具栏、上下文条或节点控制区。
- 不把整个应用页面改成无滚动；小窗口仍允许外层页面按需滚动。

## 验收标准

- [ ] AC-01：在 1280x720 视口打开 `/terminal`，无键盘、鼠标或 PTY 输出时，稳定期内 `.page-scroll.scrollHeight` 和 `.terminal-host` 高度不持续增加，连续采样最大差值不超过 1 CSS px。
- [ ] AC-02：在窄视口打开 Terminal，终端区域保持至少可用最小高度，工具栏、终端和节点控制区不重叠；外层滚动范围在空闲时稳定。
- [ ] AC-03：改变窗口尺寸后 xterm 能重新 fit；当计算后的 cols/rows 未变化时，不重复调用 `resizeTerminal`。
- [ ] AC-04：Terminal 仍能初始化 xterm、读取 scrollback、搜索、写入、清屏和执行 Start/Stop/Restart；现有 Renderer 测试不回归。
- [ ] AC-05：Renderer typecheck、相关单元测试及一个真实浏览器布局场景通过，并记录命令和结果。

## 开放问题

- 用户描述中的“竖向滚动条无限拉长”可能同时指外层页面 scrollbar 与 xterm viewport；浏览器场景将同时采样外层 scrollHeight、host height 和 xterm viewport height确认。
- 根因当前为高置信假设：`height: 100%` 的带 padding Grid 页面位于 `overflow:auto` 容器内，且终端 Grid 行缺少明确 `min-height: 0`/边界，FitAddon 的 DOM 写入持续触发上层 ResizeObserver。实现前用失败场景确认。

## 风险备注

- 过度固定高度可能使低分辨率窗口内容被裁剪；修复应使用 viewport/Grid 约束和最小高度，而不是硬编码单一像素高度。
- ResizeObserver 去重必须保留真实宽高变化后的 PTY resize，否则终端行列可能与可视区域不一致。
