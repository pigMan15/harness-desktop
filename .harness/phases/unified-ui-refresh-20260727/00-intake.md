# Dispatcher 决策

- 意图：FEATURE
- 风险：MEDIUM
- 当前节点：INTAKE
- 下一节点：CONTEXT_PACK
- 下一角色：requirement-analyst
- 必需产物：`.harness/phases/unified-ui-refresh-20260727/00-context-pack.md`
- 必需规则/上下文：现有应用壳层、全局样式、各功能模块独立样式，以及用户已确认的全项目统一 UI 优化范围
- 原因：当前 Run 已由用户指定为中风险功能开发，必须沿既定 12 节点路径执行；INTAKE 已确认范围和路由，下一步应整理现有界面上下文与约束。

## 任务摘要

统一优化 Harness Desktop 全项目 UI，使 Runs、Workflow、Terminal、Artifacts、Gates、Knowledge、Recovery、Settings 等模块在颜色、字体、间距、圆角、阴影、组件状态和交互动效上保持一致，并补充窄屏适配与减少动态效果的无障碍支持。

## 边界

- 不改变业务逻辑、IPC/API 契约或 `.harness` 协议。
- 不回退工作区中既有的功能修复和用户改动。
- 动画保持克制，以桌面生产力工具的清晰度和稳定性为优先。
