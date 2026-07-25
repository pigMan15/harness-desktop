# Terminal 无限纵向增长修复 Intake

- RunId：`terminal-infinite-scroll-fix-20260725`
- Intent / Risk：`BUG_FIX / MEDIUM`（用户确认）
- 用户症状：进入 Terminal 模块后不执行任何操作，终端区域或页面的竖向滚动范围持续无限增长。
- 初始复现：打开已选择 Run 的 Terminal 页面，保持空闲，观察终端容器高度、页面 scrollHeight 或滚动条滑块持续变化。
- 期望：Terminal 工作区高度受可视区域约束；空闲、FitAddon resize、状态轮询和窗口 ResizeObserver 不应增加页面高度。
- 影响：页面不可稳定浏览，终端布局持续抖动或拉长，可能造成持续 resize/fit 反馈循环和性能消耗。
- 初始边界：优先修复 Renderer Terminal 布局、xterm fit 和 ResizeObserver 交互；不改变 PTY、Run 或 Workflow 业务协议。
- 验证要求：加入可自动复现“空闲后高度稳定”的回归场景，并验证桌面与窄视口均无无限增长或内容重叠。

# Dispatcher 决策

- 当前节点：`INTAKE`
- 下一节点：`REQUIREMENT_REVIEW`
- 下一角色：`requirement-analyst`
- 必需产物：`.harness/phases/terminal-infinite-scroll-fix-20260725/01-requirement-review.md`
- 原因：`BUG_FIX / MEDIUM` 路线要求先明确复现、范围和验收标准，再生成实施计划。
