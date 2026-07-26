# Context Pack

## 任务来源

- RunId：`unified-ui-refresh-20260727`
- PRD 标识：用户对话确认的全项目 UI 统一优化
- 原型/截图：本轮无新增原型；此前用户反馈覆盖页面乱码、布局单调、按钮样式不统一、局部留白和终端布局冲突等问题
- 发起人：项目用户
- 时间：2026-07-27

## 需求摘要

本次改造面向 Harness Desktop 的日常使用者，在不改变业务逻辑和 Harness 协议的前提下，建立统一、现代且克制的桌面工具视觉体系。改造覆盖应用壳层和主要业务模块，统一颜色、字体、间距、圆角、边框、阴影、按钮、表单、卡片、表格、状态标签、抽屉、空状态与错误提示。页面需要形成清晰的信息层级，并通过短时、低干扰的进入、悬停、状态变化和加载动画提升反馈感。Terminal 保持深色专业终端特征，其他模块采用深色侧栏与明亮工作区的统一布局，同时兼顾窄屏与 `prefers-reduced-motion`。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| Harness 是桌面生产力工具 | 视觉应优先清晰、稳定和信息密度，避免营销页式夸张动效 | 用户确认范围与现有产品形态 |
| 多模块共享应用壳层 | Sidebar、WorkspaceHeader、页面容器和全局 CSS 是统一体验的主要入口 | `apps/renderer/src/app/App.tsx`、`features/layout/Sidebar.tsx` |
| 模块成熟度不一致 | Runs、Gates、Knowledge 已有较现代卡片/抽屉样式，其余页面仍偏旧式工具界面 | `apps/renderer/src/app/styles.css`、`features/gates/gates.css`、`features/runs/runs.css` |
| Terminal 有特殊交互约束 | 不能以装饰性布局破坏输入、滚动、IME、会话恢复和尺寸计算 | 既有 Terminal 修复记录与 `TerminalPage.tsx` |
| 国际化已经存在 | UI 统一不得将技术术语和 Harness 内置标识错误翻译或写死 | `features/settings/LanguageContext.tsx` 与现有页面文案 |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| pitfall | 大范围覆盖页面源码容易回退既有功能，优先通过设计令牌和兼容性 CSS 渐进统一 | 当前脏工作区与前序功能改动 |
| pitfall | 终端容器的高度、overflow 和动画会影响 xterm 尺寸与滚动，应限制动画作用域 | 前序 Terminal 无限滚动、输入框和 session 修复 |
| decision | Runs 合并向导、Gates 质量中心等新界面中的结构化卡片和通俗文案必须保留 | 前序已确认实现 |
| decision | 动画应控制在约 140–260ms，并支持减少动态效果 | 用户确认的设计方向 |

## 相关代码锚点

- 应用壳层：`apps/renderer/src/app/App.tsx`
- 全局视觉与通用组件：`apps/renderer/src/app/styles.css`
- 导航：`apps/renderer/src/features/layout/Sidebar.tsx`
- 独立模块样式：`apps/renderer/src/features/gates/gates.css`、`apps/renderer/src/features/runs/runs.css`
- 主要页面：Runs、Workflow、Terminal、Artifacts、Gates、Knowledge、Recovery、Settings 对应的 `*Page.tsx`
- 国际化：`apps/renderer/src/features/settings/LanguageContext.tsx`

## 业务不变量

- 不改变 IPC、Runtime API、状态模型、工作流节点、门禁权限和 `.harness` 文件协议。
- 不回退现有 Runs 安全合并、Terminal、Knowledge、Gates、Recovery、Settings 等功能。
- 不让视觉动画干扰 Terminal 输入、滚动、尺寸计算或执行器日志阅读。
- 不以固定宽度破坏窄窗口可用性。
- 不将英文技术标识强制翻译；语言切换继续只影响界面文案。

## 待确认问题

- 无阻塞问题。用户已确认全模块覆盖、统一视觉、克制动画、窄屏适配和不改业务逻辑的边界。

## 风险判断

- 既定 Intent：FEATURE
- 既定 Risk：MEDIUM
- 风险理由：改动覆盖范围广且共享 CSS 影响多个页面，但主要限定在渲染层，可通过设计令牌、渐进覆盖、类型检查、单元测试和构建验证控制风险。

## 知识来源

- Harness run：`unified-ui-refresh-20260727`
- 代码文件：应用壳层、全局样式、模块样式与主要页面入口
- 用户反馈：本会话内对布局、按钮、乱码、终端、门禁、Runs、Artifacts 和 Knowledge 页面体验的连续反馈
