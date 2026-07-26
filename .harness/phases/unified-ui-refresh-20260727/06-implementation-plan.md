# 实施计划

## 目标

以最少的业务组件改动为 Harness Desktop 增加可集中维护的统一主题层，使应用壳层、通用控件和主要模块共享一致的视觉语言、交互状态、响应式布局和无障碍动效策略。

## 假设

- 当前 Electron/Chromium 支持 CSS 自定义属性和标准媒体查询。
- 现有页面类名足够作为兼容式主题钩子，无需重构组件树。
- 用户确认的“全项目统一 UI”允许修改 Renderer 样式入口并新增主题样式与源码测试。
- 工作区中所有既有修改均需保留；本 Run 不执行全仓格式化或清理。

## 任务列表

1. 建立主题契约测试
   - 新增 `apps/renderer/src/app/theme.test.ts`。
   - 检查语义设计令牌、应用壳层、通用控件、模块覆盖、窄屏断点、`prefers-reduced-motion` 和 Terminal 动画安全约束。
   - 先运行聚焦测试，确认因 `theme.css` 尚不存在而失败。

2. 建立统一设计令牌和应用壳层
   - 新增 `apps/renderer/src/app/theme.css`。
   - 定义品牌、表面、文本、边框、状态、阴影、圆角、动效等变量。
   - 优化 `.app-shell`、`.sidebar`、`.brand`、`.nav-link`、`.workspace-header`、`.page-scroll`、`.page` 和 `.page-header`。
   - 为页面背景、活动导航和 Runtime 状态增加轻量视觉层次。

3. 统一通用组件
   - 在 `theme.css` 覆盖 `.button`、`.icon-button`、`.field`、输入控件、`.panel`、`.toolbar`、`.data-table`、`.badge`、`.notice`、`.empty-state`、`.segmented-control` 和滚动条。
   - 补充 hover、active、focus-visible、disabled、success、warning、danger 状态。

4. 统一主要模块表面
   - 对 Projects/Runs、Workflow Studio、Artifacts、Gates、Knowledge、Recovery、Settings 的现有卡片、工作台、抽屉和工具栏类进行颜色/圆角/阴影映射。
   - 保留 Runs 与 Gates 独立 CSS 的布局和交互，不重写页面结构。
   - 减少不必要留白，统一标题、辅助文字和标签层次。

5. 安全优化 Terminal 外观
   - 仅覆盖 `.terminal-context`、`.terminal-tools`、`.terminal-search`、`.terminal-host` 外框和 `.node-controls`。
   - 禁止对 `.terminal-host`、`.xterm`、`.xterm-viewport` 使用进入 transform 动画或改变关键尺寸规则。

6. 增加动效与响应式策略
   - 添加 140–260ms 的页面淡入、卡片悬停、导航和状态反馈。
   - 在 1180px、900px、680px 断点下调整多栏、页头、操作区和侧栏。
   - 在 `prefers-reduced-motion: reduce` 下关闭动画、平滑滚动和非必要过渡。

7. 接入主题并验证
   - 修改 `apps/renderer/src/app/main.tsx`，在现有样式后导入 `theme.css`。
   - 运行聚焦测试、Renderer 全量测试、类型检查和生产构建。
   - 记录所有命令、退出码、警告和未执行的人工检查。

## TDD 记录计划

- 新增或选中的测试：`apps/renderer/src/app/theme.test.ts`，以及现有 Terminal、Runs、Gates 测试。
- 初始失败：主题契约测试应在 `theme.css` 创建前因文件不存在或令牌缺失而失败。
- 实现：新增兼容式主题 CSS，并在 `main.tsx` 导入。
- 聚焦结果：运行主题测试和 Terminal 源码约束测试。
- 扩展结果：运行 Renderer 全量测试、typecheck 和 build。

## 验证计划

```powershell
pnpm.cmd --filter @harness/renderer test -- src/app/theme.test.ts
pnpm.cmd --filter @harness/renderer test -- src/app/theme.test.ts src/features/terminal/TerminalPage.test.ts src/features/runs/merge-assistant.test.ts src/features/gates/GatesPage.test.ts
pnpm.cmd --filter @harness/renderer typecheck
pnpm.cmd --filter @harness/renderer test
pnpm.cmd --filter @harness/renderer build
```

人工检查清单：

- Sidebar 活动项、工作区标题栏和主要页面标题层级一致。
- Runs 合并向导与 Gates 质量中心布局无退化。
- Artifacts、Knowledge、Settings 的卡片和工具栏风格一致。
- Terminal 输入、滚动、搜索和底部操作栏无遮挡、无尺寸跳动。
- 窄窗口下页头和操作按钮可换行，内容无明显截断。
- 系统启用减少动态效果后无页面位移动画。

## 回滚计划

- 删除 `main.tsx` 中的 `theme.css` 导入即可整体停用新主题。
- 若仅个别模块异常，删除 `theme.css` 对应模块小节，保留全局设计令牌和安全组件覆盖。
- 不涉及数据和协议变更，无需迁移回滚。

## G2 结论

方案已定义集成边界、兼容策略、失败预演、可执行任务、验证命令和回滚路径。`G2_DESIGN = PASS`。
