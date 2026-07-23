# 需求评审

## 目标

将当前桌面程序从“页面和模块演示”完善为能够完成核心工作的本地 Harness 工作台。用户选择一个已导入项目后，可以创建和切换任务 Run、编排并安全应用面向未来 Run 的 Workflow、明确查看当前 Run 的 Gates，并探测和启动本机 Codex 执行当前节点。同时审查并修正原产品设计中上下文不清、任务与 Run 心智割裂、配置态与运行态混杂的问题。

## 范围

1. 建立全局项目与活动 Run 上下文，所有业务 API 使用真实 `projectId` 解析项目路径。
2. 将“任务”定义为 `.harness` v1 的 Run 用户视图；创建时由用户填写 Run ID、Intent、Risk，创建后持久化 active state、phase 目录和 snapshot。
3. 支持 Run 列表自动加载、创建、切换、暂停和恢复，并明确当前活动 Run。
4. Workflow Studio 加载完整 workflow 草稿，允许线性节点增删、排序和关键字段编辑；针对所选 Intent/Risk 编译草稿，展示诊断和语义差异，经确认后带 expected hash 原子应用。
5. Workflow 页面区分“项目 Workflow（影响新 Run）”和“当前 Run 冻结路线”，不得静默迁移活动 Run。
6. Gates 页面展示当前项目、Run ID、节点和角色；由 Runtime GateEngine 决定可执行动作，禁止任意直写状态。
7. Execution 页面探测本机 Codex，展示路径、版本、可用性；按当前项目、Run、Node、Role 启动真实 Codex 会话，并支持事件轮询、审批响应和取消。
8. Codex 不可用或协议不兼容时给出明确诊断，不自动伪装成成功，也不默认退回 Fake。
9. 核对 Projects、Artifacts、Recovery、Knowledge 页面是否遵循同一项目/Run 上下文，修复影响主路径的断链和误导文案。
10. 增加 Runtime 与 Renderer 聚焦测试、跨层场景测试，完成构建并重新打包桌面程序。

## 非目标

- 不引入 `.harness` v2、DAG、并行节点、循环或运行时动态分支。
- 不把 Task 作为新的项目协议实体写入 `.harness`；v1 中 Task 与 Run 一一对应。
- 不实现 Codex 云端账号、订阅或模型管理；使用本机已安装并已登录的 Codex CLI。
- 不允许 Workflow 编辑直接改变已启动 Run 的 `required_nodes`；活动 Run 迁移仍需后续 CHANGE_REQUEST 流程。
- 不实现多 Agent 并发、团队云同步、插件市场或内置代码编辑器。
- 本次不宣称安装包已签名或完成干净 Windows VM 的升级/卸载验证。

## 验收标准

- [ ] 标准 1：项目列表中选择项目后，刷新或切换页面仍保持选择；页面头部能看到项目名和路径。
  - 验证方式：导入两个 fixture 项目，分别选择并调用 Runs/Workflow，返回内容来自各自目录。
- [ ] 标准 2：没有选择项目时，Runs、Workflow、Gates、Execution 不会偷偷操作进程 cwd，而是禁用动作并引导选择项目。
  - 验证方式：Renderer 测试和桌面场景检查。
- [ ] 标准 3：创建任务时必须由用户提供合法 Run ID、Intent、Risk；非法或重复 ID 显示字段级错误。
  - 验证方式：API 与 UI 测试覆盖合法、重复、路径字符和空值。
- [ ] 标准 4：创建成功后 `.harness/state.json`、`.harness/runs/<run-id>/state.json` 和 `.harness/phases/<run-id>/` 同时存在，列表立即显示并标记为活动 Run。
  - 验证方式：Runtime 集成测试读取三个事实源。
- [ ] 标准 5：可以切换、暂停和恢复 Run，刷新后状态保持；操作不跳过 required node。
  - 验证方式：Runtime 服务测试和 UI 交互测试。
- [ ] 标准 6：Workflow Studio 加载并保留完整 workflow 的 nodes、routes、hard rules、failure recovery 和 gate meanings，编辑单一路由不会删除其他配置。
  - 验证方式：round-trip 测试比较未编辑字段。
- [ ] 标准 7：Compile 使用当前草稿而非磁盘旧配置；非法节点、角色、Gate、路由和最低规则返回定位诊断且不写文件。
  - 验证方式：Runtime workflow API 测试与 Renderer 测试。
- [ ] 标准 8：Apply 前展示语义差异并要求确认，携带 expected workflow hash；hash 冲突时拒绝覆盖并提示刷新。
  - 验证方式：并发修改集成测试。
- [ ] 标准 9：Workflow 修改后已有活动 Run 的 `required_nodes` 不变，新建 Run 使用新路线。
  - 验证方式：先建 Run、改 Workflow、再建 Run，比较两个 snapshot。
- [ ] 标准 10：Gates 页面明确显示当前 Run；切换 Run 后 Gate 状态同步切换，不再隐式绑定某个默认 run。
  - 验证方式：两个 Run 使用不同 gate 状态后切换检查。
- [ ] 标准 11：G3-G8 的 PASS 等动作经过 GateEngine 权限和确定性检查；普通 UI 请求不能直接覆盖 state。
  - 验证方式：权限拒绝与 snapshot 一致性测试。
- [ ] 标准 12：Execution 首先 probe Codex，显示真实路径和版本；可用时按当前 Run 的 current node/next role 启动，界面不再显示 `Start (Fake)`。
  - 验证方式：mock CLI 集成测试；本机 `codex --version` smoke。
- [ ] 标准 13：Execution 事件带 session、project、run 和 sequence；审批、取消与退出状态可观察，切换项目或 Run 时不会把旧日志误认为当前会话。
  - 验证方式：执行器 API 测试与 Renderer 测试。
- [ ] 标准 14：Codex 不存在、启动失败或异常退出时显示诊断且不修改节点/Gate 为成功。
  - 验证方式：缺失 executable 与非零退出测试。
- [ ] 标准 15：项目导入、任务创建、Workflow 编辑、Gate 查看、Codex 探测这条桌面主路径在打包 Runtime 上通过。
  - 验证方式：Playwright/Electron 场景或等价桌面集成检查，记录截图和命令结果。
- [ ] 标准 16：相关 TypeScript/Python 测试、类型检查、构建通过，并生成包含本次重新构建 Runtime 的 Windows 安装包。
  - 验证方式：记录测试、构建、PyInstaller、Electron packaging 命令及产物 hash。

## 开放问题

- “任务”与 Run：本次确定为同一业务对象，UI 主称呼使用“任务”，必要位置同时显示 Run ID。
- Workflow 与活动 Run：本次确定为配置态和运行态分离；Workflow 编辑只影响新任务，当前任务展示冻结路线。
- Gates 默认 Run：不存在隐藏默认值；始终使用用户当前选择项目的 active Run，并在页面显式展示。
- Codex 接入：本次使用本机 Codex CLI；Fake Executor 仅保留测试用途，不在生产 UI 默认入口出现。
- 活动 Run 迁移：不包含在本次主路径中，后续通过 CHANGE_REQUEST 独立设计。

## 风险备注

- 当前 API 全局依赖 `PROJECT_ROOT`，改为 project registry 解析会影响多数业务方法，需要集中封装并覆盖多项目测试。
- 现有 `create_run` 是纯状态构造函数，持久化应复用 `AtomicStateStore`，避免另建不一致写路径。
- Codex CLI 的真实命令行协议可能与当前 Adapter 假设不一致，必须以本机 CLI help/version 和可控 mock 进程验证。
- 当前工作区已有打包与 README 未提交变更；实现时只叠加本 run 相关文件，不回退既有改动。

## G1 评估

- 结果：PASS
- 依据：目标、范围、非目标和 16 条可观察验收标准均已记录；关键产品决策已闭合，剩余实现风险已列出。
