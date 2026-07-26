# 开发记录

## 实现摘要

采用已确认的兼容式主题层完成全项目 Renderer UI 统一改造，没有修改业务组件结构、Runtime、IPC、API 或 Harness 协议。

## 变更文件

- `apps/renderer/src/app/theme.css`
  - 新增语义设计令牌：品牌色、状态色、表面、文本、边框、阴影、圆角和动效。
  - 统一 Sidebar、品牌区、导航活动态、WorkspaceHeader、页面背景和标题层级。
  - 统一按钮、输入控件、面板、表格、标签、通知、空状态、分段控件和滚动条。
  - 对 Settings、Artifacts、Knowledge、Gates、Runs、Workflow Studio、Terminal 做兼容式视觉覆盖。
  - 新增页面、通知、抽屉和遮罩的克制动画。
  - 新增 1180px、900px、680px 响应式策略与完整的减少动态效果覆盖。
  - Terminal 核心尺寸区域不使用 transform 动画，保留现有输入、滚动和 xterm 布局约束。
- `apps/renderer/src/app/theme.test.ts`
  - 新增 4 项主题契约测试，覆盖设计令牌、加载顺序、应用壳层、通用控件、主要模块、响应式、减少动态效果和 Terminal 动画安全。
- `apps/renderer/src/app/main.tsx`
  - 在既有 `styles.css` 后导入 `theme.css`，确保主题作为可移除的兼容覆盖层生效。

## 编码思路

- 不重写脏工作区中的大型 `styles.css`，通过独立主题文件降低覆盖和回滚风险。
- 不增加第三方 UI 依赖，不修改页面数据和事件逻辑。
- 使用现有 class 名建立跨模块视觉映射，保留 Runs、Gates 等独立样式的布局职责。
- 对尺寸敏感页面区别处理：普通页面使用轻位移动画，Artifacts/Workflow 仅淡入，Terminal 禁用页面进入动画。

## 中文注释范围

本次没有新增核心业务逻辑，仅新增声明式 CSS 和源码契约测试；不存在需要解释业务约束的代码分支，因此未添加无意义行级注释。Terminal 动画安全约束通过测试名称与阶段产物明确记录。

## TDD 记录

- 新增或选中的测试：`apps/renderer/src/app/theme.test.ts`，并由现有 Renderer 测试集覆盖 Terminal、Runs、Gates、Artifacts、Settings 等模块。
- 初始失败：`pnpm.cmd --filter @harness/renderer test -- src/app/theme.test.ts` 退出码 1；新增套件因 `theme.css` 不存在而 `ENOENT`，原有 37 项测试通过，失败原因符合预期。
- 实现：新增 `theme.css` 并在 `main.tsx` 中于 `styles.css` 后导入。
- 聚焦结果：同一命令退出码 0；14 个测试文件、41 项测试全部通过。项目 Vitest 脚本将参数以 `--` 传递，实际执行了完整 Renderer 测试集。
- 扩展结果：留给 `COMPILE` 与 `UNIT_TEST` 节点由 verifier 独立执行。

## 差异检查

- `git diff --check -- apps/renderer/src/app/main.tsx apps/renderer/src/app/theme.css apps/renderer/src/app/theme.test.ts`：退出码 0。
- 未修改或清理工作区中的其他用户文件。

## 后续验证

- Renderer typecheck
- Renderer 全量 test
- Renderer production build
- 如可运行桌面应用，按验收清单进行主要页面和窄窗口人工检查

## 追加修正：模块间距统一

- 用户反馈：各模块的页面外边距、页头间距和卡片/网格间距不一致。
- 根因：Knowledge 与新版 Gates 根容器未统一使用 `.page`；主题中存在普通页面 28px、Knowledge 30px，以及主要网格 16/17/18px 混用。
- 修改文件：`theme.css`、`spacing.test.ts`、`KnowledgePage.tsx`、`GatesDashboard.tsx`。
- 实现：新增页面、区块和网格间距令牌；Knowledge/Gates 接入统一页面根类；Runs 使用统一堆叠 gap，消除页头与表格的重复 margin；响应式间距由令牌统一调整。
- 中文注释：本次仅修改声明式样式和 className，不涉及核心业务逻辑，无需新增行级注释。
- TDD 初始失败：新增间距契约测试 3 项全部失败，证明缺少共享令牌和根容器映射。
- TDD 实现后：15 个测试文件、44 项测试全部通过。
- 范围控制：未修改数据流、Runtime API、Terminal 核心尺寸和业务事件。
