# Harness Desktop 功能与 Codex 集成审计

## 来源

- RunId: `feature-audit-codex-integration-20260724`
- Intent / Risk: `QUERY / NA`
- Phase dir: `.harness/phases/feature-audit-codex-integration-20260724`
- 原始设计: `doc/desktop-architecture.md`、`doc/desktop-implementation-plan.md`
- 本次性质: 只读代码和文档审计；未修改业务源码，未运行构建、单元测试或部署命令。
- 工作区状态: 当前仓库存在用户/历史未提交变更与多个打包目录，本报告只引用当前源码，不对其做清理或回滚。

## 结论摘要

当前项目不是“功能没有实现”，而是已经具备 Harness v1 的项目协议、Run、线性 Workflow 编译、Gate、Artifact 和 Electron/Runtime 基础，但执行闭环尚未完成。尤其是 Codex 现在属于“适配器有代码、真实运行入口存在、产品配置和生命周期不完整”，所以页面能显示 Start，却不能稳定地完成一次可恢复的 Harness 节点执行。

最直接的 Codex 阻塞是本机路径发现：Runtime 默认使用 `CodexAdapter(os.environ.get("HARNESS_CODEX_PATH", "codex"))`，`probe()` 使用 `shutil.which("codex")`。当前 Windows PATH 中命中的 `codex.exe` 是 WindowsApps 目录下的应用别名，实际执行返回 `Access is denied`；本机 Hermes 安装的 `codex-cli 0.145.0` 可以执行，且 `codex app-server --help` 可用，但 Desktop 没有设置页面、路径选择或运行时注入 `HARNESS_CODEX_PATH` 的链路。

第二个更大的阻塞是“执行完成”没有回写 Harness：Codex `turn/completed` 只被转换成 `exited` 事件，API 只更新 SQLite 中的 executor session 状态，不会验证 phase artifact、标记当前 node 完成、写入 `.harness/runs/<run_id>/state.json`、推进 Dispatcher 或触发后续 Gate。因此即使 Codex 启动成功，Run 也不会自然向下一个节点推进。

## 实现矩阵

| 领域 | 当前状态 | 证据与差异 |
| --- | --- | --- |
| Electron 安全壳与 Runtime 握手 | 基本完成，仍有版本校验缺口 | `apps/desktop/src/main/index.ts:27-32` 设置了隔离、无 Node、sandbox；`runtime/src/harness_runtime/api/auth.py:45-69` 只要求 Desktop 版本非空，尚未严格做版本兼容判断。 |
| 项目导入与 `.harness` 兼容初始化 | 已实现基础闭环 | `apps/desktop/src/main/project-import.ts:73-110` 支持无 `.harness` 的 initialize、已有目录的 append/skip；`runtime/src/harness_runtime/projects/bootstrap.py:67-139` 做缺失文件预览、安全路径和回滚。该能力需要重新打包后的 Runtime 才能在发布包中得到证明。 |
| 项目注册/维护 | 部分完成 | Runtime 有 `unregister_project`，但 `runtime/src/harness_runtime/api/app.py:71-149` 没有 unregister/relocate/repair RPC，Projects 页面也没有相应操作。 |
| 多 Run 基础 | 部分完成 | `runtime/src/harness_runtime/runs/service.py:25-143` 支持按用户 Intent/Risk 创建、编译并冻结 `required_nodes`；`state_store.py:68-104` 支持每个 Run 的锁、revision 和快照；UI 只有单一 active context，缺删除、归档、重命名、批量管理和并行执行视图。 |
| Run/节点生命周期 | 未闭环 | `runtime/src/harness_runtime/workflow/dispatcher.py:12-22` 只能计算下一个节点，`confirm_node()` 也只是库函数；API 没有 `node.start`、`node.complete`、`node.confirm`、`node.reject` 路由。`run.pause/resume` 明确“不推进或完成节点”（`runs/service.py:205-221`）。 |
| Workflow 读取与新 Run 编排 | 已实现 | `runs/service.py:51-67` 从当前 `workflow.yaml` 编译路线并写入新 Run；所以外部手工写入一个合法自定义 workflow 后，创建任务可以读取它，且活动 Run 的路线仍冻结。 |
| Workflow Studio | 部分完成，不能称为完整可视化编排 | `WorkflowPage.tsx:59-87` 支持当前 Intent/Risk 的路线 preview/apply；Canvas 只展示线性列表并支持拖动排序，Catalog 只有 22 个内置节点（`NodeCatalog.tsx:4-16`），没有自定义节点创建、Node ID/role/artifact/gates 编辑、删除/复制、failure recovery/hard rules 编辑，也没有导入/导出入口。`useWorkflowDraft.ts:18-26` 虽有 remove/undo/redo 状态动作，但页面没有暴露这些操作。 |
| Workflow backend 扩展 | 接口孤岛 | `workflow/versioning.py`、`workflow/zip_io.py`、`workflow/drafts.py` 有版本、ZIP 和 draft 函数，但 `api/app.py:102-113` 只有 get/compile/preview/diff/apply，未接入版本、导入、导出、恢复 API；`apply_draft()` 也没有在 apply 时保存版本记录。 |
| Gate | 部分完成，存在自定义 Gate 语义偏差 | `api/app.py:315-381` 做当前角色权限、确定性 artifact 检查、失败回退和 revision 写回；但 `gates/engine.py:110-123` 使用硬编码 G1-G8 artifact 映射，没有读取 `.harness/evals/gates.yaml` 中每个 Gate 的 `required_artifacts`，未知自定义 Gate 可能没有 artifact 检查；UI `GatesPage.tsx:4-7,54-60` 只列 8 个内置 Gate，没有 waive、custom Gate 或 waiver metadata 操作。 |
| Artifact | 部分完成 | `artifacts/service.py` 支持列表、Markdown/JSON/文本预览和 SHA-256；`artifacts/watcher.py` 有快照 diff，但全仓没有 Runtime/API 调用方，不能产生 `ArtifactChanged` 实时事件；UI 也没有打开目录、完整安全状态或导出诊断包。 |
| Codex 路径发现 | 当前不可用 | `runtime/src/harness_runtime/api/app.py:33-35` 只读取环境变量或默认 `codex`；`adapter.py:30-40` 只做 `shutil.which`/显式路径。Desktop `runtime-supervisor.ts:63-68` 只注入 Runtime token 和 project root，没有 Codex 路径设置。当前 `Get-Command codex.exe` 命中 `C:\Program Files\WindowsApps\...\codex.exe`，直接运行返回 `Access is denied`；显式 Hermes binary 返回 `codex-cli 0.145.0`。 |
| Codex app-server | 具备最小协议链路 | `codex/app_server.py:43-97` 已实现 `initialize`、`initialized`、`thread/start`、`turn/start`；本机 `app-server --help` 成功并支持 `--stdio`。`thread_params` 中 approval policy、reviewer、ephemeral、cwd 均硬编码，模型、sandbox、网络、reasoning 等不能配置。 |
| Codex 事件 | 部分完成 | `app_server.py:99-102` 每次 HTTP poll drain 内存 list；`adapter.py:104-120` 只从当前进程内存取事件。刷新 Renderer、Runtime 重启或轮询不及时会丢事件，没有 sequence 补发或持久化事件表。 |
| Codex 审批 | 未形成统一策略 | `app_server.py:216-231` 将 Server Request 映射为 command/file/permission/external；独立的 `approvals/service.py` 支持更完整的分类和二次确认，但 `api/app.py` 未实例化或调用 `ApprovalService`。真实 app-server 的 `allow_session` 直接映射为 `acceptForSession`，而本地 ApprovalService 只接受 `allow_once/deny`。UI 的 deploy/delete/dangerous_git 二次确认与真实 app-server category 不一致，实际危险请求可能不会触发对应确认。 |
| Codex 完成后的 Harness 推进 | 缺失 | `api/app.py:540-557` 只把终端事件映射为 executor session `completed/failed`；没有 artifact 校验、节点完成、state snapshot、Dispatcher、Gate 或下一节点事件。 |
| Codex 恢复 | 只有扫描 | `recovery/service.py:27-94` 能按 PID 显示 recoverable/orphan/lost，但 `adapter.py:137-141` 的 `recover()` 只查当前进程内存 `_sessions`，不能从 SQLite 中重新附着；Recovery 页面只有 scan/cleanup（`RecoveryPage.tsx:22-60`），没有 attach/resume/terminate 决策。 |
| Audit / 幂等 | 模块存在但未接入 RPC | `persistence/audit.py` 和 `api/idempotency.py` 有实现，`api/app.py:52-68` 没有读取 `request_id`、去重或写审计；没有 audit.query/diagnostics.export 页面/API。 |
| Knowledge | 只能人工 review 孤立候选 | `knowledge/service.py:32-86` 支持候选和 accept/reject，但没有从 `19-knowledge-promotion.md` 自动生成候选的调用方；`api/app.py:398-405` 忽略 `projectId`，存在跨项目混看/误审风险。 |
| Gateway / Agent Registry / MCP | 缺失 | 全仓没有 gateway、provider registry、MCP 或 ACP 接入；只有 `FakeExecutor`、未接入 API 的 `BridleAdapter` 和 Codex adapter。一个 Run 目前没有可选 Agent Profile，也没有“默认 gateway 对应哪个 Run”的数据模型。 |
| Windows 发布 | 开发打包已具备，发布闭环缺失 | `forge.config.ts:5-20` 只配置 Squirrel 和 Runtime extraResource，没有签名、更新源、发布元数据；`scripts/package-desktop.ps1:46-59` 运行本地 typecheck/pytest 后打包，但没有干净 VM 安装/升级/卸载和签名证据。 |

## Codex 当前“用不了”的调用链

```text
ExecutionPage Start
  -> preload startExecution
  -> Electron IPC execution:start
  -> Runtime _execution_start
  -> CodexAdapter.probe()
  -> shutil.which("codex")
  -> WindowsApps codex.exe (Access is denied)
```

即使把路径问题临时绕过，后续链路仍是：

```text
Codex app-server
  -> 内存事件队列
  -> HTTP poll drain
  -> UI 显示日志/审批
  -> terminal event 只更新 executor_sessions
  -> 不推进当前 Harness node
```

因此不能把问题归因于登录。实际修复应先解决可执行文件配置和诊断，再补执行完成协议；单纯把默认值改成某个本机路径会留下不可移植的发布缺陷。

## Workflow 编排与创建任务的真实语义

1. 创建任务时，用户在 `RunsPage.tsx:44-52` 提交 `runId + intent + risk`。
2. Runtime `create_run()` 读取项目当前 `.harness/workflow.yaml`，调用 compiler，生成并冻结 `state.required_nodes`（`runs/service.py:51-67`）。
3. 之后修改 `workflow.yaml` 不会改写已创建 Run；新 Run 才读取新路线。
4. 目前可以通过外部编辑合法 YAML 来创建包含自定义节点的任务；但桌面 Workflow Studio 不能完整创建这种自定义节点，因为 Catalog 没有自定义节点输入，也没有 YAML import/export 控件。
5. 点击 Execution 的 Start 只会拿到当前 Run 的 `current_node/next_role/phase_dir`，在 DEVELOPMENT 节点必要时创建 worktree，然后启动 Codex；它不是“完成任务”按钮，也不会自动推进 Workflow。
6. “Gateway 默认对应哪个 Run”目前没有答案：系统直接以 `(project_id, run_id, node_id, session_id)` 绑定 Codex session，未实现 gateway/profile 概念。

## 主流开源 Agent 的可借鉴模式

本次只读参考了公开仓库 README（2026-07-24）：

- [OpenHands Agent Canvas](https://github.com/OpenHands/agent-canvas/blob/main/README.md)：前端连接一个或多个 Agent Server，支持本地、远程、云后端和 ACP-compatible agents，并明确把 Docker/VM 作为 sandbox 部署边界。可借鉴“Agent backend 与桌面 UI 解耦”和“同一会话切换后端”的模型。
- [Cline](https://github.com/cline/cline/blob/main/README.md)：共享 Agent core 同时服务 CLI/IDE，工具和生命周期可通过 SDK/MCP 扩展；每个编辑和终端命令都有人在环审批，并提供 Plan/Act 和 checkpoint。可借鉴统一审批、可审查 diff、checkpoint/rollback，而不是只展示终端日志。
- [Goose](https://github.com/block/goose/blob/main/README.md)：provider 与 extension 分离，支持多 provider、ACP 订阅和 MCP extension。可借鉴 Agent Profile、Provider capability、Tool/MCP registry 三层模型。
- [Continue](https://github.com/continuedev/continue/blob/main/README.md)：同一 coding agent 通过 CLI、VS Code、JetBrains 多表面使用，并把配置/文档作为核心入口。可借鉴“核心执行服务独立于 Renderer”，避免每个 UI 自己拼装执行状态。
- [Aider](https://github.com/Aider-AI/aider/blob/main/README.md)：模型可替换，结合 repo map、Git 提交和自动 lint/test。可借鉴执行后的变更摘要、验证命令、可回退 checkpoint；具体状态和 Gate 仍应由 Harness 权威协议管理。

建议采用的共同抽象：

```text
AgentProvider
  -> capability probe / auth status / executable or endpoint
AgentProfile
  -> provider + model + sandbox + network + approval policy
ExecutionBinding
  -> project_id + run_id + node_id + profile_id + session_id
EventStore
  -> sequence + cursor + replay + redacted audit
ToolRegistry
  -> built-in tools + MCP/ACP tools + policy classification
```

## 完善清单

### P0：先恢复可用性和 Harness 闭环

1. **Codex 设置与发现**：新增 Settings/Diagnostics；支持文件选择、环境变量、PATH 候选、Hermes/官方安装候选；每个候选执行 `--version` 和 `app-server --help`，保存可用绝对路径到 AppData，Runtime 启动时注入；诊断显示失败阶段和修复建议，不显示 token。
2. **真实 Codex smoke**：准备临时 Harness 项目，验证 probe、登录状态（仅显示已登录/未登录）、启动 query、输出、approval、cancel、异常退出；没有可用 Codex 时只能标记 unavailable，不能把 mock 结果当真实通过。
3. **执行完成协议**：Codex 终端后由 Runtime 校验当前节点所需 artifact 和 state revision，提供显式 `node.complete`；普通节点完成后更新 authoritative Run snapshot 并调用 Dispatcher，confirmation 节点必须人工确认，Gate 节点不能由 Codex 越权标 PASS。
4. **统一 ApprovalService**：真实 app-server 请求先进入统一分类/策略，再映射为 Codex response；统一 `allow_once/allow_session/deny/cancel`，危险操作、网络、目录外、删除、部署和危险 Git 的二次确认与审计都由 Runtime 决定，Renderer 只展示。
5. **Workflow Studio 最小可用编辑**：补齐自定义节点创建/编辑、删除、复制、Undo/Redo、当前路线导入/导出和完整 semantic diff；保存前仍由 Runtime 编译检查并原子 apply。让“自定义 workflow -> 创建新 Run”成为 UI 可完成流程。

### P1：可靠性、恢复和可审计执行

1. **事件持久化与重放**：SQLite 保存 session event、sequence、approval 和 redacted payload；poll 改为 cursor/ack，不再 drain-only；Runtime 重启后可从 cursor 补发。
2. **真正恢复**：持久化 Codex 启动命令、PID/start time、thread/turn、profile 和工作目录；启动时校验 PID 复用并重新 attach/subscribe；提供继续、终止、标记丢失三种用户决策。
3. **Run 执行历史与并行视图**：每个 Run 可查看 session、node、tool、approval、artifact、gate 时间线；支持多个 Run 并行而不依赖单一 active UI context。
4. **Gate 配置一致性**：从 `gates.yaml` 读取 required artifacts；支持 custom Gate、waive metadata、解除 BLOCKED 和审计；移除 engine 的硬编码映射。
5. **Audit / idempotency / diagnostics RPC**：所有 command 使用真实 request_id 去重，增加 audit.query、diagnostics.export，并验证 SQLite 删除后可从项目协议重建索引。
6. **Workflow 版本与迁移**：将 versioning、ZIP import/export、draft history 接入 API/UI；apply 前保存旧 hash 和版本，恢复版本仍走完整编译与 diff。

### P2：多 Agent 与发布产品化

1. **Agent Registry / Gateway**：建立 provider/profile registry；一个 Run 显式绑定 profile，gateway 只负责路由/能力，不隐式改变 Run；支持 Codex、Fake、Bridle 及未来 ACP/MCP agent。
2. **MCP/ACP Tool Registry**：工具声明、能力、来源、沙箱范围和审批分类统一登记；每次 tool call 带 provider/session/run/node 关联。
3. **Settings/Keychain/日志**：模型、reasoning、sandbox、网络、环境变量白名单、凭据、日志等级和脱敏统一管理，敏感值写 OS Keychain。
4. **Windows 发布**：签名、更新源、版本迁移、干净 VM 安装/升级/卸载、诊断包和 release evidence 完整验证。

## 建议验收标准

### Codex 可用性

- Settings 可以选择本机可执行文件；保存后重启 Runtime 仍能显示同一路径。
- Probe 返回 path、version、app-server、auth、approval、cancel、recover capability；任何失败都给出具体阶段和可执行修复提示。
- 在干净临时项目上，真实 Codex 能启动一个非破坏性任务，收到输出和审批，用户可以 deny/cancel，Runtime 重启后可看到 session 状态；测试结果不依赖 `_FakeCodexAdapter`。

### Workflow 与 Run

- 用户可以从 UI 创建一个包含自定义 node/role/artifact/gate 的合法线性 workflow，preview 显示完整 diff，apply 后新 Run 读取它。
- 非法 role、artifact 越界、未知 Gate、重复 route、缺系统最低节点的 workflow 不能落盘。
- 新 Run 的 `required_nodes` 固定；已有 Run 的路线不因 workflow 修改改变。
- Codex 完成当前节点后，artifact、state snapshot、revision、next node 和审计均可核对；失败按 Gate recovery 回退，第三次失败进入 BLOCKED。

### 安全与恢复

- 真实 Codex 的 file/command/network/external/permission/deploy/delete/dangerous Git 请求均通过同一 ApprovalService；allow session、二次确认和拒绝结果与策略一致。
- UI 刷新、Runtime 重启、断线重连不会丢失已有事件；按 sequence 可以补发且不重复。
- SQLite 删除后能从 `.harness` 重建项目、Run、Artifact、Gate、session 摘要；密钥和 token 不出现在 artifact、日志和诊断包。

## 文档差异与维护建议

- `doc/desktop-architecture.md:158-175` 把 Workflow Studio、Codex 审批、恢复列为首发目标；当前实现矩阵表明这些功能只完成了部分接口，发布说明必须标为 partial，而不能只按页面存在判定完成。
- `doc/desktop-implementation-plan.md:17-23` 的 2026-07-22 核对快照仍写“文件不存在”，但这些文件当前已经存在；该快照已过期，建议以后用可验证的实现矩阵替代静态 checkbox。
- `README.md:96-103` 宣称 Workflow Studio、Codex Adapter、Approval Service、Recovery 已完整提供；其中 version history、统一审批、真实恢复和节点推进并没有产品闭环，应改成“基础实现/限制”。
- `docs/workflow-studio.md` 声称支持 import/export 和 semantic diff；当前 UI 只真正使用 structured preview/apply，import/export/version recovery 仍未暴露。
- `docs/troubleshooting.md` 建议“去 Settings 配置 Codex”，但当前没有 Settings 页面。这是直接导致用户无法自救的文档/产品不一致。

## 证据边界与不沉淀内容

- 本次报告没有运行构建、pytest、Vitest、Playwright 或真实 Codex turn，因此不宣称编译、测试、打包或真实执行通过。
- 官方 Codex 手册在本环境中未能通过文档工具获取；Codex 相关协议结论以本机 `codex-cli 0.145.0`、`app-server --help` 和仓库 mock app-server 测试为依据，未把未验证的官方行为当作事实。
- 不沉淀 API Key、登录输出、用户路径中的秘密或一次性命令输出；只保留可复用的根因、边界和验收规则。

## 待用户确认

- 是否接受把 P0 的“执行完成协议 + Codex 设置/发现 + 统一审批”作为下一次 FEATURE / HIGH 的实现范围。
- 是否接受 Agent Registry/Profile/MCP 作为 P2，而不是在当前 Codex adapter 上继续增加更多硬编码分支。
- 本草稿仅供人工 review；未自动写入长期知识库。
