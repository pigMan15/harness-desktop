# 需求评审

## 目标

修复当前打包桌面软件在 Projects 页面点击“Import project”后缺少可观察响应的问题，使目录选择、取消、有效项目导入、无效项目拒绝和 Runtime 错误均有明确、可结束的界面状态；有效项目导入后应立即出现在列表中并成为所选项目。

## 范围

1. 复现并定位 `ProjectsPage -> preload -> Electron IPC -> native dialog -> Runtime project.import -> Workspace refresh/select` 链路的真实断点。
2. 修复直接导致点击无响应或结果不可见的 Renderer、Desktop bridge、IPC 注册/对话框、Runtime 错误传递或刷新逻辑。
3. 为导入进行中、取消、成功和失败提供可观察反馈，保证按钮状态最终恢复。
4. 增加聚焦自动化测试，至少覆盖 Electron Main 导入处理和 Renderer 成功/失败反馈。
5. 重新验证打包应用中的实际项目导入路径，并在需要时重建 Runtime/桌面包。

## 非目标

- 不重构 Projects 之外的页面。
- 不改变 `.harness` 项目协议、项目 ID 算法或用户指定的 Run intent/risk。
- 不引入新的文件浏览器组件替代系统目录对话框，除非证据证明系统对话框是根因且无法可靠修复。
- 不把取消操作或错误伪装成导入成功。
- 不复用旧 Run 的 G3-G8 门禁结果。

## 验收标准

- [ ] 标准 1：在 Runtime healthy 的打包桌面端点击“Import project”，系统目录选择器能够打开；处理期间按钮禁用并显示进行中状态，Promise 结束后按钮恢复。
  - 验证方式：Electron 主进程聚焦测试加实际 unpacked/packaged 桌面场景。
- [ ] 标准 2：选择包含有效 `.harness` 的目录后，项目出现在 Projects 列表、自动成为 selected project，并显示成功反馈。
  - 验证方式：Renderer 组件测试和打包 Runtime 场景，断言项目 ID、列表和选择状态。
- [ ] 标准 3：取消目录选择时，不调用 Runtime import，界面显示非错误的取消反馈，按钮恢复且已有项目列表不变。
  - 验证方式：Electron IPC handler 单元测试与 Renderer 测试。
- [ ] 标准 4：选择不存在、无 `.harness`、无法读取或 Runtime 返回错误的目录时，界面显示明确错误，按钮恢复，不添加虚假项目。
  - 验证方式：Desktop bridge/Renderer 聚焦测试和 Runtime 项目 API 测试。
- [ ] 标准 5：Electron 导入 handler 不依赖隐藏 cwd，必须把用户选择的绝对目录原样传给 `project.import`；无可用窗口和 native dialog 异常也返回结构化错误。
  - 验证方式：IPC handler 单元测试断言 dialog 入参、Runtime RPC 入参与错误结果。
- [ ] 标准 6：相关 TypeScript 类型检查、Desktop/Renderer 聚焦测试与生产构建通过；若修改进入桌面包，则生成新的桌面产物并完成导入 smoke。
  - 验证方式：记录命令、退出码、产物路径与 smoke 结果。

## 开放问题

- 用户报告未包含所选目录、是否出现系统目录对话框或 Runtime 状态；这些信息通过本地复现和调用链测试获得，不阻塞先建立失败测试。
- 当前代码在用户取消时故意忽略 `cancelled`，且导入按钮只禁用、不改文字，这本身会形成“没反应”的体验；仍需验证是否同时存在 IPC/dialog 的功能性故障。
- 当前 Desktop 测试没有实例化 IPC handler，项目导入主链路存在明显自动化覆盖空白。

## 风险备注

- Electron Main 的 handler 内嵌于 `app.whenReady()`，直接测试困难，可能需要提取小型可注入函数；应保持改动局部，不改变其它 IPC。
- 原生目录对话框在 headless 测试中不能真实交互，需用可注入 dialog mock 验证逻辑，并用实际桌面 smoke 补足。
- Runtime 启动中或掉线时 `runtimeCall` 返回 `{ error }`；Renderer 必须保证错误可见并结束 loading 状态。

## G1 评估

- 门禁：`G1_REQUIREMENTS`
- 结果：`PASS`
- 依据：问题目标、范围、非目标、6 条可观察验收标准、未知项和跨层风险均已记录；无需用户业务取舍即可进入实施计划。
