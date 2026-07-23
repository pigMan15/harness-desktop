# 方案设计

## 现状上下文

当前代码具备 Project Service、Run 状态构造、AtomicStateStore、Workflow Compiler/Draft、GateEngine 和 CodexAdapter 等局部能力，但 `runtime/api/app.py` 没有把这些能力按真实项目串起来。Renderer 大量传入固定 `local`，API 又忽略 `projectId` 并操作进程级 `PROJECT_ROOT`。这使项目导入、Run、Workflow、Gates、Artifacts 和 Execution 看似分层，实际共享一个隐式 cwd。

产品设计也存在三个结构性问题：

1. “任务”和协议 Run 没有建立清晰的一一映射，用户只看到技术化 Run 页面，缺少可完成工作的主路径。
2. 项目配置态 Workflow 与活动 Run 冻结路线混在同一页面，容易误以为修改会作用于当前任务。
3. 页面级 API 参数包含 projectId，但应用没有统一 Selected Project/Active Run 上下文，导致每个页面自行猜测默认值。

另外，当前 CodexProcess 使用 `--project/--run/--node/--role/--phase-dir`，与本机 `codex-cli 0.145.0-alpha.27` 实际参数不一致。本机帮助证明：`codex exec --json` 可非交互执行，但 exec 模式不支持交互审批；完整审批需要 `codex app-server --stdio`。本次已用 CLI 自带 `generate-json-schema --experimental` 生成并核对 initialize、thread/start、turn/start、审批和通知协议。

## 推荐方案

### 1. 统一 Workspace Context

在 Renderer 新增 `WorkspaceContext`，维护：

- 注册项目列表；
- `selectedProjectId`，持久化到 localStorage；
- 所选项目摘要及 `activeRunId`；
- refresh/select 接口。

App 顶部显示当前项目和活动任务；没有选中项目时，依赖项目的页面统一进入空状态并禁用写操作。Projects 页面只负责导入、验证和选择，不再用 `.` 触发隐式导入或目录选择。

Runtime 新增 `resolve_project(project_id)`，只从 SQLite registry 解析并重新校验路径。除 project.list/import/validate 外，所有方法必须显式传 projectId；空值、未知 ID、丢失目录返回结构化错误，不回退到 cwd。

### 2. Task/Run 生命周期闭环

协议层继续使用 Run，UI 主称呼使用“任务”，并同时展示 Run ID。Runtime 在创建时：

1. 解析项目和现有 run IDs；
2. 调用 `create_run` 编译冻结路线；
3. 创建安全 phase 目录；
4. 用 `write_state` 原子写 active state 和 snapshot；
5. 更新 registry 的 `active_run_id`；
6. 返回新 revision 和完整 Run DTO。

新增 run.switch/pause/resume API。switch 从 snapshot 读取目标状态，再通过 `write_state` 使其成为 active；pause/resume 只作用于 active Run，避免修改非活动 snapshot 时悄悄切换上下文。列表返回完整摘要与 `active` 标记。

### 3. Workflow 配置态与运行态分离

`workflow.get` 返回完整可编辑模型、原始 YAML、workflow hash、当前 active Run 冻结路线。Renderer 草稿包含完整 nodes 和所选 Intent/Risk route，不再手工拼出只有一条 route 的残缺 YAML。

新增 `workflow.preview`：接收 nodes、selected intent/risk 和 route，服务端读取当前完整 YAML，将编辑内容合并进副本，保留其他 routes、hard rules、failure recovery、gate meanings 和未知兼容字段；随后规范化 YAML、Pydantic 校验、编译草稿并返回诊断、compiled route、semantic diff、preview YAML 和 base hash。失败时不写文件。

`workflow.apply` 必须携带 preview 的 base hash，重新验证并使用现有 `apply_draft` 原子替换。成功后返回新 hash。活动 Run snapshot 不变，UI 明确标注修改只影响新任务。

Canvas 保持 v1 线性路线：支持节点添加、删除、重排和 role/artifact/gates 编辑；系统最低节点在适用路线中显示锁定，服务端编译仍是最终约束。

### 4. Gates 明确归属并收回越权写入

`gate.list(projectId)` 返回 project、active Run 摘要、gates、current node 和 caller role。页面标题区始终展示 Run ID；切换任务后重新加载。

移除 `gate.evaluate(gateId, status)` 任意写状态的设计，改为 `gate.evaluate(projectId, gateId)`：Runtime 从 active state 和 workflow 读取 phase_dir、gate 定义、failure recovery，用 GateEngine 确定结果，再通过 `write_state` 写 active state/snapshot。G3-G8 仅当当前节点对应 verifier 角色时允许评估；WAIVE 作为带 metadata 的独立后续动作，不通过通用状态按钮伪造。

### 5. Codex App Server 集成

保留 ExecutorAdapter 抽象，重写 Codex 实现为 app-server 会话：

1. `executor.probe` 接收可选路径，实际运行 `--version` 和 `app-server --help`，返回 available/path/version/features/diagnostics；路径存在但执行失败必须判为 unavailable。
2. `executor.start` 从 selected project active state 读取 run_id/current_node/next_role/phase_dir，拒绝调用方伪造 node/role。
3. 启动 `codex app-server --stdio`，发送 `initialize`、`initialized`、`thread/start` 和 `turn/start`。
4. thread 使用 `cwd=<project root>`、`sandbox=workspace-write`、`approvalPolicy=on-request`，developerInstructions 只包含当前 Harness 节点、角色文件、phase_dir 和不可跳过约束。
5. 解析 `thread/*`、`turn/*`、`item/*`、delta、error 通知为统一 ExecutionEvent；每个事件附带 projectId/runId/sessionId/sequence。
6. 收到 `item/commandExecution/requestApproval`、`item/fileChange/requestApproval` 等 server request 时保存 request id 并向 UI 发 approval_required；用户响应映射为 app-server 的 accept/decline/cancel。
7. cancel 先发 `turn/interrupt`，超时后终止 app-server 进程；退出状态写入 executor_sessions。

Execution 页面先 probe，再允许启动当前节点；展示 CLI 路径、版本、项目、Run、Node 和 Role。支持填写或浏览独立安装的 Codex CLI 路径。WindowsApps 内置路径若无法被外部进程执行，诊断明确要求选择可执行的独立 CLI，不把文件存在误报为可用。

### 6. API 与 UI 类型收敛

把 `window.harness` 声明移到独立类型文件，更新 preload、Electron IPC、contracts 和 Runtime dispatch 的方法签名。错误统一返回 `{code, message, pointer?}`，Renderer 不再依赖 alert 和模糊 `unknown`。

UI 采用安静的工作台布局：紧凑侧栏、固定上下文栏、表格和工具面板，不做营销式页面。导航用一致图标，按钮状态、加载、空状态、错误状态和确认对话完整；中文作为主界面语言，协议枚举保留英文。

## 受影响文件/模块

- Runtime 项目解析：`runtime/src/harness_runtime/projects/service.py`
- Runtime Run 生命周期：`runtime/src/harness_runtime/runs/service.py`
- Runtime Workflow preview/apply：`runtime/src/harness_runtime/workflow/drafts.py`
- Runtime Codex：`runtime/src/harness_runtime/executors/codex/adapter.py`、`process.py`、`events.py`，新增 app-server 会话管理模块
- Runtime RPC：`runtime/src/harness_runtime/api/app.py`
- Desktop bridge：`apps/desktop/src/main/index.ts`、`apps/desktop/src/preload/index.ts`
- Shared contracts：`packages/contracts/src/rpc.ts`
- Renderer context/layout：`apps/renderer/src/app/App.tsx`、新增 WorkspaceContext 与共享样式/组件
- Renderer 功能页：Projects、Runs、Workflow Studio、Gates、Artifacts、Execution、Recovery、Knowledge
- 测试：Runtime API/Run/Workflow/Codex，Renderer context/任务/Workflow/Execution，E2E 主路径

## 数据流

```text
用户选择项目
  -> WorkspaceContext.selectedProjectId
  -> typed preload API(projectId, ...)
  -> Electron JSON-RPC params.projectId
  -> Runtime resolve_project(projectId)
  -> project_root/.harness + AtomicStateStore

创建任务
  -> intent/risk/runId
  -> compile workflow
  -> write state + snapshot + phase_dir
  -> update active_run_id
  -> refresh WorkspaceContext

编辑 Workflow
  -> structured draft
  -> server merge + compile + diff + base hash
  -> user confirmation
  -> apply(expected hash)
  -> only future Runs consume new route

启动 Codex
  -> active state(current node/role/phase dir)
  -> codex app-server JSON-RPC
  -> normalized events/approval requests
  -> UI respond/cancel
```

## 兼容性

- 不改变 `.harness` v1 文件结构和枚举，不增加 Task 协议字段。
- 现有项目 registry 数据继续可用；未知 projectId 不再回退 cwd，这是有意修复的行为变化。
- Workflow apply 仍输出合法 v1 YAML，规范化可能调整排版但语义保持；应用前展示 semantic diff。
- Fake Executor 保留给测试，不从生产 UI 默认入口暴露。
- Codex app-server 是当前 CLI 的 experimental 子命令，因此 probe 必须检查能力；不支持时明确禁用真实启动。

## 回滚

1. Runtime/API 回滚：恢复到变更前代码后，项目 `.harness` 仍保持 v1 格式；SQLite 新增的 executor/session 数据可忽略。
2. Workflow 回滚：apply 前保存当前 YAML hash/内容到 workflow_versions；出现问题时经同一 compile/apply 路径恢复上一版本。
3. Run 操作回滚：每次 write_state 都保留 runs snapshot；切回之前 run 即可恢复 active state。
4. UI 回滚：WorkspaceContext 只保存 projectId 到 localStorage，删除该键即可回到无选择状态，不影响项目文件。
5. Codex 回滚：关闭 app-server 功能入口不会影响 Run/Workflow/Gates；终止子进程并将会话标记 interrupted。

## 失败预演

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| 操作了错误项目 | projectId 仍被忽略或 stale | 所有 API 首行 resolve registry，未知 ID 失败 | 双项目隔离测试、页面上下文栏 | 禁用写操作并重新选择项目 |
| 新 Run 覆盖旧 Run 且无快照 | 创建只写 active state | AtomicStateStore 同步 snapshot，创建前校验 ID | 检查 state/snapshot/phase 三件套 | switch 回旧 snapshot |
| Workflow 编辑删除其他 routes | 前端重新拼整份 YAML | 服务端结构化 merge，round-trip 测试 | semantic diff 出现无关删除即阻止 | workflow_versions 恢复 |
| Gate 越权 PASS | UI 传任意 status | API 不接受目标 status，GateEngine 决定 | 权限测试、state diff | 恢复 snapshot |
| Codex 文件存在但不可执行 | WindowsApps ACL/包身份限制 | probe 实际运行 version/app-server help | diagnostics 显示 Access denied | 选择独立 CLI 路径 |
| Codex 协议升级 | experimental app-server 字段变化 | initialize/probe 能力检查、宽容解析通知、mock schema fixtures | 启动错误和未知事件日志 | 禁用启动，保留诊断和其它功能 |
| UI 测试通过但安装包失败 | dev 环境 Python/CLI 掩盖打包差异 | 重新构建 Runtime 并在 unpacked app 上走主路径 | packaged smoke + runtime hash | 回滚安装包，保留上一版 |

## 停止条件

- 多项目隔离无法证明，或任何写 API 仍可在缺失 projectId 时落到 cwd。
- Run 创建不能同时保证 active state、snapshot 和 phase_dir。
- Workflow preview 无法保留未编辑字段或 expected hash 冲突可被绕过。
- Codex probe 失败却仍允许启动，或审批请求无法关联到正确 session/run。

## 被拒绝的替代方案

- 继续使用全局 `PROJECT_ROOT`：无法支持导入/选择项目，是当前问题根因。
- 把 Task 设计成新的 `.harness/tasks` 协议：违反 v1 兼容目标，且与 Run 重复。
- 前端手工生成整份 YAML：会丢失未编辑字段，也无法可靠处理 YAML 结构。
- 使用 `codex exec --json` 作为完整接入：能执行但明确不支持交互审批，不满足原设计。
- 在 Electron Main 直接读写项目文件：破坏 Runtime 唯一写入口和审计边界。
- 页面继续各自保存 projectId/runId：会再次产生跨页上下文漂移。

## 变更请求增量：同项目多 Run 并行

本节由已确认的 `08-change-request.md` 触发，替换前文“根 state.json/active Run 是 Gate 与 Execution 事实源”的设计。Workflow 仍保持 v1 线性路由；这里的“并行”是多个独立 Run 同时开发，不是单个 Workflow 内 DAG 或并行节点。

### 状态权威与锁

1. `.harness/runs/<run_id>/state.json` 是该 Run 的权威状态与 revision 来源。
2. 根 `.harness/state.json` 仅是 selected Run 的 v1 兼容投影；并发写入时最后投影可变化，但不得影响任一 Run 的权威文件。
3. `RunStateStore` 只锁 `.harness/runs/<run_id>/.lock`。不同 Run 的状态写入不共享项目级状态锁。
4. 旧项目首次按 runId 读取时，允许从同 runId 的根投影迁移出权威文件；迁移后所有业务写入只写 Run 文件。

### API 绑定

- Run pause/resume、Gate list/evaluate、Artifact list/read、Execution start 显式要求 `projectId + runId`。
- expectedRevision 与指定 Run 的权威文件比较，不与根投影比较。
- Execution poll/respond/cancel 通过 SQLite session 的 projectId/runId 归属校验，启动后不读取 UI selected Run。
- UI selected Run 只提供默认操作目标；切换视图不会迁移状态、审批或事件。

### 工作区隔离

- 每个可执行开发 Run 保存 `branch_name` 与 `worktree_path`。
- Git 项目通过 `git worktree add -b codex/<run_id> <worktree_path> HEAD` 建立独立工作区；已存在的同名合法 worktree 可恢复使用。
- Codex thread cwd 固定为 session 创建时记录的 worktree_path；phase_dir 与 Run 权威状态仍位于项目 Harness 数据目录。
- 非 Git 项目可以创建/查看 Run，但开发执行返回 `RUN_WORKTREE_UNAVAILABLE`，避免两个 Run 直接写同一源码目录。

### 恢复与回滚

- Runtime 重启按 executor_sessions 的 project_id/run_id/worktree_path 恢复或标记 lost，不根据根 state.json 猜测归属。
- 删除/清理 worktree 是显式生命周期操作，不在取消执行时自动删除，避免丢失未提交变更。
- 回滚时可逐 Run 恢复权威 state 文件；根投影可以从任意 selected Run 重建。
