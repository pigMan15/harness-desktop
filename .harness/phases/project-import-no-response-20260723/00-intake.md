# Dispatcher 决策

- 意图：`BUG_FIX`（用户指定，不覆盖）
- 风险：`MEDIUM`（用户指定，不覆盖）
- 当前节点：`INTAKE`
- 下一节点：`REQUIREMENT_REVIEW`
- 下一角色：`requirement-analyst`
- 必需产物：`.harness/phases/project-import-no-response-20260723/00-intake.md`
- 必需规则/上下文：`.harness/commands/bugfix.md`、`.harness/rules/code-search.md`、`.harness/rules/build.md`、`.harness/rules/evidence.md`
- 原因：用户报告当前打包桌面软件执行“导入项目”后没有可观察响应，需要先复现并明确预期，再定位跨 Renderer、Desktop bridge 与 Runtime 的真实断点。

## 问题记录

- Run：`project-import-no-response-20260723`
- 用户现象：导入项目没反应。
- 初始复现路径：启动当前打包桌面软件，进入 Projects，输入或选择项目目录并触发“导入项目”。
- 实际结果：界面没有可观察到的成功、失败或项目列表变化反馈。
- 期望结果：有效 Harness 项目被导入并出现在项目列表中，可立即选择；无效路径、权限错误或 Runtime/API 错误应显示明确且可操作的诊断，按钮加载状态应正常结束。
- 已知环境：Windows 桌面安装包/Unpacked 应用，bundled Runtime 来自本次 clean build。
- 待确认事实：问题发生在目录选择、Renderer 事件处理、preload/IPC、Runtime RPC、项目校验，还是成功后的列表刷新/反馈阶段；必须通过代码路径、自动化测试和实际运行复现确定。

## 范围边界

- 修复 Projects 导入主路径及直接相关反馈、状态刷新和桥接契约。
- 增加能够在修复前暴露问题、修复后通过的聚焦测试或等价复现场景。
- 不进行无关页面重构，不改变用户指定的 intent/risk，不复用旧 Run 的门禁结论。
