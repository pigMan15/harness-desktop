# 方案设计

## 现状上下文

- Renderer 采用 React + 单一应用壳层，`App.tsx` 负责 Sidebar、WorkspaceHeader 和路由内容区。
- `styles.css` 同时承载基础组件与多个业务页面样式，已有 300+ 行规则且存在大量硬编码颜色、5–8px 圆角和局部响应式覆盖。
- Runs 与 Gates 使用独立 CSS，Knowledge 和 Artifacts 已在全局文件中形成更现代的卡片/工作台风格，导致模块之间视觉成熟度不一致。
- 当前已存在 LaunchSplash 动画及基础 `prefers-reduced-motion`，但普通页面、导航、卡片和状态反馈缺少统一动效体系。
- 工作区包含大量前序功能改动，因此不适合整文件重写或批量格式化页面组件。

## 推荐方案

采用“兼容式主题层”而非重写现有页面：

1. 新增独立 `theme.css`，由 Renderer 入口在现有 `styles.css` 之后加载。
2. 在主题层定义语义设计令牌：品牌色、表面色、文本色、边框、阴影、圆角、间距、动效时长和缓动。
3. 使用低至中等权重选择器覆盖现有通用组件和明确页面类，不删除原规则，保证回滚简单。
4. 统一应用壳层：扩大侧栏层次、增加品牌徽记、活动导航轨道、柔和工作区背景和半透明标题栏。
5. 统一通用组件状态：按钮、表单、面板、表格、标签、通知、空状态、滚动条和 focus-visible。
6. 对 Runs、Gates、Knowledge、Artifacts、Settings、Workflow、Recovery、Projects 等已有类做有限外观映射，保留布局与事件逻辑。
7. Terminal 只优化上下文栏、工具栏、搜索框、边框和阴影；不对 `.terminal-host`、`.xterm` 核心容器施加 transform 或影响尺寸的进入动画。
8. 页面进入动画作用于普通 `.page`，对 `.terminal-page` 和尺寸敏感工作台明确排除或仅使用 opacity。
9. 增加 1180px、900px、680px 等窄屏覆盖，保证侧栏收缩、页头换行、卡片单列和工具栏可换行。
10. 扩展 `prefers-reduced-motion: reduce`，关闭主题层全部动画和非必要过渡。

## 受影响文件/模块

- 新增：`apps/renderer/src/app/theme.css`
- 修改：`apps/renderer/src/app/main.tsx`，追加主题样式导入
- 可选新增：`apps/renderer/src/app/theme.test.ts`，验证设计令牌、减少动态效果和关键安全约束
- 原则上不修改业务页面 TSX；只有 CSS 无法提供必要语义钩子时才做最小 className 补充
- 兼容覆盖：`styles.css`、`features/runs/runs.css`、`features/gates/gates.css` 中已有类名

## 数据流

本次不新增业务数据流。样式加载链路为：

`main.tsx → styles.css / 模块 CSS → theme.css 语义令牌与兼容覆盖 → 浏览器最终级联样式`

用户设置、WorkspaceContext、RuntimeContext、Terminal 会话和各模块 API 调用均保持原样。

## 兼容性

- 使用当前 Electron/Chromium 已支持的 CSS 自定义属性、`color-mix`、`backdrop-filter` 和媒体查询；关键可读性不依赖滤镜生效。
- 保留所有现有 class 名与基础样式，主题文件缺失时应用仍可使用原界面。
- 不引入新依赖、网络字体或运行时主题状态。
- 中英文长度差异通过 flex-wrap、min-width: 0 和响应式规则处理。
- `prefers-reduced-motion` 用户得到无动画版本；键盘用户得到统一 `focus-visible` 轮廓。

## 失败预演

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| 页面局部样式被意外覆盖 | 通用选择器权重过高 | 以语义类和变量覆盖，避免 `!important` 与全局后代重置 | 单元测试、构建、本地逐页检查 | 移除对应主题规则或整个主题导入 |
| Terminal 再次出现尺寸/滚动异常 | transform 或 padding 作用于 xterm 核心容器 | 不动画 `.terminal-host/.xterm`，保持其 box model | Terminal 测试和本地滚动/输入检查 | 回退 Terminal 主题小节 |
| Runs/Gates 新界面退化 | 独立 CSS 与主题层冲突 | 只统一颜色、阴影和控件，不重排其核心结构 | 检查合并向导与门禁质量中心 | 删除模块兼容覆盖 |
| 窄屏操作按钮被挤出 | 固定宽度和不换行 | 断点下启用 wrap、单列、100% 按钮 | 缩放 Electron 窗口检查 | 回退对应响应式规则 |
| 动画引发眩晕或干扰 | 动画过长/范围过大 | 140–260ms、低位移，并提供 reduce 模式 | 源码测试和系统减少动态效果检查 | 关闭主题动画变量 |

### 停止条件

- 发现必须改动 Terminal 会话逻辑或业务 API 才能完成视觉目标。
- 主题覆盖导致现有关键功能测试失败且无法通过局部规则隔离。
- 需要删除或重写用户已有的大量页面改动。

## 回滚

- 第一层：删除 `main.tsx` 中的 `theme.css` 导入，立即恢复原有视觉。
- 第二层：按模块删除主题文件中的局部覆盖，保留设计令牌与已验证的全局组件。
- 本方案不迁移数据、不变更协议，因此无需数据回滚。

## 被拒绝的替代方案

- 整体引入第三方 UI 框架：依赖、包体、迁移面和回归风险过高。
- 全量重写 `styles.css`：会覆盖当前脏工作区中的既有功能样式，难以审阅和回滚。
- 每个页面单独重新设计：容易继续产生视觉分叉，也增加重复代码。
- 大范围修改 JSX 结构：视觉目标不需要业务组件重构，且可能破坏事件与布局逻辑。
