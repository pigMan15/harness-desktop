# 多 Run、Codex 终端与 Workflow 本期完整实施方案

## 来源

- RunId: `multirun-codex-terminal-workflow-20260724`
- Intent / Risk: `QUERY / NA`
- Phase dir: `.harness/phases/multirun-codex-terminal-workflow-20260724`
- 输入依据:
  - `doc/desktop-architecture.md`
  - `doc/desktop-implementation-plan.md`
  - `.harness/phases/feature-audit-codex-integration-20260724/19-knowledge-promotion.md`
  - 用户确认的产品方向：Harness 内嵌真实终端，直接运行 Codex CLI；支持多个 Run；完善当前线性 Workflow 编排。
- 交付约束：本文列出的多 Run、Codex 终端、Workflow、节点推进、验证和打包能力全部属于本期范围，不拆分为后续 P0/P1/P2 版本。
- 本 Run 只产出方案，不修改业务源码、不执行构建或测试。

## 1. 目标

本期把 Harness Desktop 从“单一 selected Run + 不完整 Codex app-server 入口 + 有限路线编辑器”升级为：

```text
一个项目
  ├── Run A
  │     ├── 独立 Run state / revision / phase_dir
  │     ├── 独立 worktree
  │     ├── 独立 Codex PTY terminal
  │     └── 独立 Workflow / Gate / Artifact 视图
  ├── Run B
  │     └── 同上，可与 Run A 并行
  └── Run C
        └── 同上
```

用户可以：

1. 导入项目并创建多个 Run。
2. 在 Runs 页面选择、筛选、暂停、恢复和查看每个 Run。
3. 为不同 Run 启动独立 Codex 终端并并行工作。
4. 在终端内直接使用 Codex 原生 TUI、登录、审批和命令交互。
5. 完成工作后由用户显式确认当前节点，Runtime 校验 artifact 后推进 Workflow。
6. 从 UI 完整编辑、导入、导出和版本化自定义线性 Workflow，新配置只影响新 Run。

## 2. 本期边界

### 2.1 必须完成

- 多 Run 独立状态、选择上下文和并行终端。
- 每个代码修改型 Run 使用独立 Git worktree。
- 直接启动真实 `codex.exe` 的交互式 PTY 终端。
- Codex 路径自动发现、手动选择、版本验证和持久设置。
- 一个 Run 同一节点只允许一个活动终端 session。
- 终端启动、输入、ANSI 输出、中文、粘贴、resize、Ctrl+C、停止和重启。
- Run/Terminal/Workflow/Gate/Artifact 全链路显式携带 `projectId + runId`。
- 完整线性 Workflow Studio：节点、角色、artifact、Gate、路线、hard rules、failure recovery、导入导出、diff、版本恢复。
- 手动节点完成、人工确认、Gate 评估、失败回退和 BLOCKED 闭环。
- Runtime/Electron/Renderer 聚焦测试、真实 Codex smoke、打包 smoke 和 Windows 安装包验收。

### 2.2 明确不采用

- 不把 `codex app-server --stdio` 作为本期主要执行路径。
- 不解析 Codex ToolCall、ApprovalRequested 等结构化协议事件。
- 不在 Harness 中重复实现 Codex 自带的 TUI 审批界面。
- 不引入通用 Gateway、MCP/ACP Provider Registry、多 Agent 自主协作。
- Workflow 仍为 `.harness` v1 可表达的线性路线，不增加 DAG、循环和条件分支。
- 原始 PTY 进程不承诺跨应用重启重新附着；重启后保留 session 摘要并允许在原 Run 中重新启动 Codex。

## 3. 架构决策

### ADR-1：Codex 使用 PTY 终端模式

```text
React Renderer / xterm.js
        |
        | typed preload IPC
        v
Electron Main / TerminalManager
        |
        | node-pty / Windows ConPTY
        v
configured codex.exe
```

原因：用户需要 Codex 原生终端体验，不需要 Harness 解析 Agent 协议。PTY 可以保留交互输入、ANSI 色彩、全屏 TUI、Ctrl+C、窗口尺寸和原生审批流程，比 stdout pipe 或 app-server 更符合需求。

### ADR-2：PTY 必须由 Electron Main 管理

Renderer 保持 `contextIsolation=true`、`nodeIntegration=false`、`sandbox=true`。Renderer 只能通过受控 preload API 创建、输入、resize 和停止终端，不能传入任意 executable、任意 cwd 或直接访问 Shell。

### ADR-3：Run snapshot 是业务权威，根 state 只是投影

每个 Run 的权威状态为：

```text
.harness/runs/<run_id>/state.json
```

根 `.harness/state.json` 仅保留当前 selected Run 的兼容投影。所有业务 API 必须显式接收 `runId` 并调用 `read_run_state(project_root, run_id)`，不得根据根 state 猜测执行对象。

### ADR-4：每个代码修改 Run 必须隔离 worktree

多 Run 并行修改同一项目根目录不可接受。创建或首次启动可能修改代码的 Run 时，Runtime 必须建立并记录独立 worktree。不能创建 worktree 时，该 Run 进入可诊断的 BLOCKED 状态，不回退到共享项目根目录继续修改。

### ADR-5：终端退出不等于节点完成

Codex 退出码为 0 只表示终端进程正常退出。节点完成必须由用户显式触发，Runtime 再验证 artifact、revision、节点角色和确认要求，之后才写 Run snapshot 并推进 Dispatcher。

## 4. 权威数据模型

### 4.1 Renderer Workspace

```typescript
interface WorkspaceState {
  selectedProjectId: string
  selectedRunId: string
  projects: ProjectSummary[]
  runsById: Record<string, RunSummary>
  terminalSessionsById: Record<string, TerminalSessionSummary>
}
```

`activeRun` 单对象替换为 `selectedRunId + runsById`。切换 selected Run 只改变当前页面展示，不终止或重绑定其他 Run 的 session。

### 4.2 Terminal Session

```typescript
interface TerminalSession {
  sessionId: string
  projectId: string
  runId: string
  nodeId: string
  executablePath: string
  cwd: string
  pid?: number
  status: 'starting' | 'running' | 'exited' | 'failed' | 'stopped' | 'interrupted'
  startedAt: string
  endedAt?: string
  exitCode?: number
  cols: number
  rows: number
}
```

SQLite 保存 session 摘要和最终状态；终端原始 scrollback 默认保存在 AppData 日志中并限制大小，不写入项目 `.harness` 产物。敏感输出不得进入诊断包，除非经过脱敏。

### 4.3 Codex Settings

```typescript
interface CodexSettings {
  executablePath: string
  version: string
  lastProbeStatus: 'available' | 'unavailable'
  lastProbeAt: string
  source: 'user' | 'environment' | 'hermes' | 'path'
}
```

设置保存在 Electron AppData 或 Runtime SQLite，不写入项目仓库。Renderer 不能直接修改文件路径，必须通过 Main 的选择对话框和 probe 结果保存。

### 4.4 Workflow Version

```text
project_id
version_id
content_hash
yaml_content
author
summary
created_at
```

项目 `.harness/workflow.yaml` 仍是当前权威版本；SQLite 版本历史可重建或删除，不得反向覆盖项目文件。

## 5. 多 Run 生命周期

### 5.1 创建

```text
用户提交 runId + intent + risk
  -> Runtime 读取当前 workflow.yaml
  -> 编译 intent/risk route
  -> 校验系统最低规则
  -> 创建 phase_dir
  -> 创建 runs/<run_id>/state.json
  -> 为代码修改路线准备 worktree
  -> 将该 Run 加入列表
  -> 可选择为 selected Run
```

`required_nodes` 在创建时冻结；后续 Workflow apply 不得改变已有 Run。

### 5.2 选择与切换

- Runs 页面允许单选一个 Run 作为当前查看对象。
- 已启动的其他 Run 继续执行，终端 session 不随选择变化。
- Workflow、Gates、Artifacts、Execution 页全部显示 selected Run ID。
- 页面路由推荐使用 `/projects/:projectId/runs/:runId/<view>`，刷新后可以恢复同一上下文。
- `run.switch` 只更新 selected Run 投影，不获得终止其他 session 的权限。

### 5.3 暂停、恢复与删除约束

- Pause 只阻止新节点和新终端启动，不强制终止已有终端；用户可选择同时停止。
- Resume 不推进节点，只解除 `user_paused`。
- 活动 session、未合并 worktree 或未归档 artifact 存在时禁止删除 Run。
- 本期增加 Archive，而不是直接物理删除权威 Run 目录；真正删除需要单独二次确认。

## 6. Codex 发现与启动

### 6.1 候选顺序

```text
1. 用户在 Settings 中确认的绝对路径
2. HARNESS_CODEX_PATH
3. 已知 Hermes 安装目录下的实际 vendor codex.exe
4. PATH 中枚举到的所有可执行候选
```

每个候选都必须直接执行：

```text
codex.exe --version
```

只有退出码 0 且输出符合 Codex CLI 版本格式的候选才能保存。当前命中 WindowsApps 且返回 `Access is denied` 的候选必须继续尝试后续路径，不能在第一个候选失败后停止。

### 6.2 启动方式

推荐主按钮：`Start Codex`。Main 直接执行绝对路径，不经过 PowerShell：

```typescript
pty.spawn(codexExecutable, [], {
  cwd: runContext.worktreePath,
  env: controlledEnvironment,
  cols,
  rows,
})
```

可选次按钮：`Open Shell`，用于用户自行运行其他命令。它必须明确标识为用户本机终端，并与 Codex session 使用相同的 Run/cwd 绑定。

### 6.3 环境

- 继承用户必要的登录和终端环境。
- 增加只读环境标识：`HARNESS_PROJECT_ID`、`HARNESS_RUN_ID`、`HARNESS_NODE_ID`、`HARNESS_PHASE_DIR`。
- 不把 Runtime token、项目数据库路径或其他秘密传给 Codex。
- cwd 必须是 Runtime 返回并经过 canonicalize 的项目根或 Run worktree；Renderer 不能覆盖。

## 7. TerminalManager 与 IPC

### 7.1 Main 管理器

新增 `apps/desktop/src/main/terminal-manager.ts`，职责：

- 保存 `Map<sessionId, PtySession>`。
- 校验同一 `projectId + runId + nodeId` 没有活动 session。
- 调用 Runtime 获取可信 Run execution context。
- 启动、写入、resize、停止和回收 PTY。
- 将 data/exit/error 事件发送给对应 BrowserWindow。
- Runtime/窗口退出时有序终止 PTY，并把状态写为 interrupted/stopped。
- 限制每项目和全局最大并行 session 数，默认每 Run 1、每项目 4、全局 8，可在 Settings 调整。

### 7.2 Preload API

```typescript
terminal.create(projectId, runId, kind)
terminal.list(projectId)
terminal.write(sessionId, data)
terminal.resize(sessionId, cols, rows)
terminal.stop(sessionId)
terminal.restart(sessionId)
terminal.onData(callback)
terminal.onExit(callback)
terminal.onStatus(callback)
```

所有调用必须验证 session ownership。Renderer 只能向已创建的 session 写入数据，不能通过 IPC 提交完整 spawn 命令。

### 7.3 Runtime context API

新增：

```text
run.executionContext(projectId, runId)
```

返回：

```text
runId
revision
status
currentNode
nextRole
phaseDir
projectRoot
worktreePath
branchName
terminalAllowed
terminalBlockReason
```

Runtime 负责 Run 状态、worktree 和路径安全；Electron Main 负责 OS 进程。

## 8. Execution 页面

页面由现有 app-server 日志面板改为真实终端工作台：

```text
Run: feature-a             Status: IN_PROGRESS
Node: DEVELOPMENT          Role: developer
Worktree: G:\...\feature-a
Codex: 0.145.0             Session: RUNNING

[Start Codex] [Open Shell] [Stop] [Restart] [Clear]

┌──────────────── xterm.js terminal ────────────────┐
│ Codex TUI / shell output                           │
└────────────────────────────────────────────────────┘

[Complete current node]
```

要求：

- `xterm.js` 固定占据主要工作区，不放在装饰性卡片中。
- 使用 FitAddon 自动 resize，ResizeObserver 做防抖。
- 支持复制、粘贴、查找和清屏；不拦截 Codex 使用的常见快捷键。
- 终端顶部始终显示 Run、Node、cwd 和 session 状态，防止用户在错误 worktree 操作。
- Runs 页面显示每个 Run 的 terminal badge；可以从 badge 跳转到对应 Execution 上下文。
- 切换 selected Run 后展示该 Run 已有 session；其他 Run 的 session 保持运行。

## 9. Workflow Studio 完整优化

### 9.1 三栏布局

```text
Node Catalog | Workflow Canvas / Route Timeline | Inspector
```

Node Catalog：

- 显示 22 个内置节点。
- 显示项目自定义节点。
- 支持创建、搜索、拖入和复制节点。
- 系统最低节点有锁定标识，但锁定取决于当前 intent/risk effective rules，不使用前端硬编码一刀切。

Canvas / Timeline：

- v1 使用清晰的线性纵向路线，不伪装成可连任意边的 DAG。
- 支持添加、删除、复制和拖动排序。
- 支持 Undo/Redo。
- 显示 role、artifact、gates、完成/锁定/错误状态。
- Intent/Risk 使用分段选择器；切换后加载对应 route draft。

Inspector：

- 编辑 Node ID、role、artifact、gates。
- 自定义 Node ID 必须经过白名单校验。
- role 从项目 `.harness/agents` 实际文件枚举。
- Gate 从 `.harness/evals/gates.yaml` 实际定义枚举。
- artifact 只能填写 phase_dir 下安全相对文件名。

### 9.2 全局配置

增加独立标签：

- Routes：编辑所有 Intent/Risk 路线。
- Nodes：编辑节点目录。
- Recovery：编辑 `failure_recovery.max_auto_retries_per_gate` 和 `gate_to_node`。
- Rules：查看项目 hard rules 和系统 effective hard rules；系统规则不可删除。
- YAML：查看/编辑完整 YAML，并与可视化草稿双向同步。
- Versions：查看 hash、作者、摘要、时间和 diff，选择恢复。

### 9.3 导入导出

- 导入 `.yaml/.yml`：先解析、深度验证和显示 diff，不直接写项目。
- 导入 Workflow ZIP：复用现有 Zip Slip、大小和符号链接防护，同时预览 agent/gate 文件冲突。
- 导出 Workflow ZIP：包含 workflow、引用的 agents、gates 和 manifest/hash。
- 导出当前 YAML：通过 Electron Save Dialog 写入用户选择位置，Renderer 不直接写文件。

### 9.4 Compile/Preview/Apply

保存前必须检查：

1. Node ID 唯一。
2. role 文件存在。
3. artifact 是安全相对文件名。
4. Gate 已定义。
5. route 节点存在且不重复。
6. 支持的 Intent/Risk 都有合法路线。
7. 代码变更路线包含 COMPILE、UNIT_TEST、EVIDENCE_CAPTURE。
8. HIGH 路线包含要求的确认和 PRE_MORTEM。
9. HIGH/DEPLOYMENT 包含 prerelease 和 interface test。
10. failure recovery 引用有效，无无限回退。
11. v1 不含 DAG、循环或条件表达式。

Apply 流程：

```text
草稿
  -> Runtime compile/validate
  -> 完整 semantic diff
  -> 用户确认
  -> expected hash + project lock
  -> 再次校验
  -> 原子替换 workflow.yaml
  -> 保存 workflow version
  -> 广播 WorkflowChanged
```

任何失败都不能部分写入项目。活动 Run 的 frozen route 不变。

## 10. 节点推进闭环

### 10.1 API

新增：

```text
node.complete(projectId, runId, expectedRevision)
node.confirm(projectId, runId, decision, comment, expectedRevision)
node.reject(projectId, runId, comment, expectedRevision)
```

### 10.2 普通节点完成

```text
用户点击 Complete current node
  -> Runtime 读取权威 Run state
  -> 校验 expected revision
  -> 校验 current node 未完成且位于 required_nodes
  -> 校验目标 artifact 存在、普通文件、非空、路径安全
  -> 将 node 加入 completed_nodes
  -> Dispatcher 选择第一个未完成节点
  -> 设置 current_node / next_role / status
  -> 原子写 Run snapshot
  -> selected Run 时更新根投影
  -> 写审计并广播 RunChanged
```

### 10.3 Confirmation 与 Gate

- REQUIREMENT_CONFIRMATION、SOLUTION_CONFIRMATION、ACCEPTANCE_CONFIRMATION、CODING_DESIGN_CONFIRMATION 必须显示 accept/reject/defer，并记录确认人、时间和意见。
- COMPILE、UNIT_TEST、ATDD、EVIDENCE、PRERELEASE、ACCEPTANCE 的 Gate 仍由 Runtime 的 verifier 权限检查控制。
- Gate Engine 必须从项目 `gates.yaml.required_artifacts` 读取要求，移除 G1-G8 的硬编码 artifact 映射。
- 增加 Gate waive UI/API，waiver 必须包含 scope、reason、owner、time。
- Gate 失败按目标 Run 的 failure recovery 回退；超过自动重试上限进入 BLOCKED。

## 11. Runtime 与 IPC 方法清单

本期完成并统一以下业务方法：

```text
project.list / import / validate / repair / unregister / relocate
run.list / create / select / pause / resume / archive / executionContext
node.complete / confirm / reject
workflow.get / compile / preview / diff / apply
workflow.import / export / versions / restore
gate.list / evaluate / waive
artifact.list / read / hash
terminal session projection create / update / list
diagnostics.export
```

Terminal PTY 方法保留在 Electron IPC，不通过 Python 转发字节流。Runtime 只保存可信业务上下文和 session projection。

## 12. 并发、事务与资源

- Run state 写入使用每 Run 独立 lock 和 revision。
- workflow apply 使用项目级 lock。
- worktree 创建和删除使用项目级 Git 操作锁。
- 同一 Run 的 terminal/session 创建使用 `(project_id, run_id, node_id, active)` 唯一约束。
- terminal data 事件带 `sessionId/projectId/runId/nodeId/sequence`。
- Main 按 session 维护 sequence，Renderer 丢失事件时可请求有限 scrollback replay。
- 每个 session 设置最大 scrollback、日志文件大小和轮转策略，防止无限占用内存和磁盘。
- 应用退出时先向 PTY 发送终止，再超时强杀；记录 `interrupted`，绝不自动完成节点。

## 13. 安全要求

- Renderer 不持有 Runtime token、不调用 Node/Shell、不决定 cwd。
- Main 只从 Runtime 获取经过授权的 project/worktree 路径。
- Codex executable 必须是用户确认或 probe 通过的普通文件，拒绝符号链接和目录。
- `Open Shell` 是显式用户终端能力，界面必须显示工作目录和 Run 绑定；它不走 Agent 自动审批，但所有输入均由本机用户直接提供。
- Codex 登录和审批继续使用 Codex 原生 TUI；Harness 不读取或保存 API Key。
- 日志、错误和诊断包对 token、Authorization、常见 secret 环境变量做脱敏。
- Run worktree 路径必须位于受控 worktree root，canonicalize 后不可逃逸。

## 14. 预计代码变更范围

### Electron Main / Preload

- `apps/desktop/src/main/terminal-manager.ts`：新增 PTY 生命周期。
- `apps/desktop/src/main/codex-discovery.ts`：候选扫描、probe 和设置。
- `apps/desktop/src/main/index.ts`：注册 terminal/settings IPC。
- `apps/desktop/src/main/runtime-supervisor.ts`：不再依赖 Runtime 启动 Codex；保留 Runtime 业务进程。
- `apps/desktop/src/preload/harness-api.ts`、`index.ts`：增加 typed terminal/settings API。
- `apps/desktop/package.json`、Forge 配置：增加 `node-pty`、原生模块 rebuild/unpack 和打包资源规则。

### Renderer

- `apps/renderer/src/features/terminal/TerminalPage.tsx`：新增 xterm 工作台。
- `apps/renderer/src/features/terminal/useTerminalSession.ts`：session 订阅和状态。
- `apps/renderer/src/features/settings/CodexSettingsPage.tsx`：路径选择、probe、版本状态。
- `apps/renderer/src/features/layout/WorkspaceContext.tsx`：改为 selectedRunId/runsById/session summaries。
- `apps/renderer/src/features/runs/RunsPage.tsx`：session 状态、archive、并行 Run 导航。
- `apps/renderer/src/features/workflow/**`：三栏 Studio、完整 Inspector 和全局配置标签。
- `apps/renderer/src/features/execution/ExecutionPage.tsx`：替换为终端入口或兼容重定向。
- `apps/renderer/src/app/App.tsx`、Sidebar：增加 Terminal 和 Settings 路由。

### Runtime

- `runtime/src/harness_runtime/api/app.py`：显式 runId、executionContext、node、workflow version/import/export、gate waive、diagnostics API。
- `runtime/src/harness_runtime/runs/service.py`：archive、execution context、worktree requirement。
- `runtime/src/harness_runtime/runs/worktrees.py`：并行 Run 隔离、冲突和清理状态。
- `runtime/src/harness_runtime/nodes/service.py`：新增节点完成/确认服务。
- `runtime/src/harness_runtime/workflow/drafts.py`、`versioning.py`、`zip_io.py`：接入业务 API。
- `runtime/src/harness_runtime/gates/engine.py`：读取真实 Gate required_artifacts，支持 waive。
- `runtime/src/harness_runtime/persistence/database.py`：terminal session projection、Codex settings 或 AppData 设置表。
- 现有 `executors/codex/app_server.py` 保留为实验代码但不从主 Execution UI 调用，避免与 PTY 主链路并存造成双实现歧义。

## 15. 本期工作包与完成顺序

以下是同一期内部执行顺序，不代表延期范围；所有工作包都必须完成才能验收：

1. **契约与迁移**：定义 selected Run、terminal session、execution context、node complete、workflow version/import/export RPC；添加兼容迁移。
2. **Codex Settings**：实现发现、probe、选择、持久化和错误诊断，解决 WindowsApps/Hermes 路径问题。
3. **PTY 基础**：接入 node-pty、TerminalManager、preload API 和 xterm.js，完成单 Run 真实 Codex 终端。
4. **多 Run 上下文**：重构 WorkspaceContext 和所有页面为显式 runId，支持不同 Run 的独立 session。
5. **Worktree 隔离**：所有代码修改型并行 Run 强制独立 worktree，加入冲突和清理保护。
6. **节点推进**：实现 complete/confirm/reject、artifact 校验、snapshot、Dispatcher 和 Gate 衔接。
7. **Workflow Studio**：完成自定义节点、所有路线、Inspector、规则、recovery、YAML、import/export、diff 和 version restore。
8. **Gate/Artifact 修正**：动态 Gate 配置、waiver、custom Gate、artifact hash 和 Run 维度视图。
9. **恢复与诊断**：终端中断状态、scrollback、session 摘要、日志脱敏和 diagnostics export。
10. **全量验证与打包**：Runtime、Desktop、Renderer、E2E、真实 Codex、并行 Run、Workflow、安装包验证全部通过。

## 16. 测试方案

### 单元与契约

- Codex candidate discovery：第一个候选 Access denied 时继续探测并选中可用路径。
- TerminalManager：创建、写入、resize、停止、超时 kill、ownership、并行上限。
- WorkspaceContext：切换 selected Run 不终止其他 Run session。
- Run state：不同 Run 并发 revision 不互相冲突。
- Worktree：不同 Run 路径、branch、清理和失败回滚。
- Node complete：artifact 缺失、空文件、越界、revision conflict、confirmation 权限。
- Workflow：自定义 node、全部 route、hard rules、recovery、import/export、version restore。
- Gate：动态 required_artifacts、自定义 Gate、waive、失败回退和第三次 BLOCKED。

### 集成与 E2E

1. 创建 Run A、B、C，确认 snapshot/phase_dir/worktree 独立。
2. 为 Run A、B 同时启动终端，输入输出不串线。
3. 切换 selected Run，两个 session 继续运行且页面显示正确归属。
4. 关闭 Run A 终端不影响 Run B。
5. 真实 Codex 使用配置路径启动，显示版本、TUI，并可 Ctrl+C/stop/restart。
6. Codex 完成工作后手动 complete，artifact 合法时推进，缺失时拒绝。
7. 导入一个包含自定义 node/role/gate 的 Workflow，preview/diff/apply 成功。
8. 使用新 Workflow 创建 Run C，已有 Run A/B 路线保持不变。
9. 非法 Workflow 无法写入，原文件 hash 不变。
10. Runtime 或 Desktop 退出后 session 标记 interrupted，Run 不被自动完成。

### Windows 打包

- Electron 原生模块与当前 Electron ABI 匹配。
- `node-pty`/ConPTY 在 packaged app 中可启动、输入和 resize。
- 安装包不依赖系统 Python 运行 Runtime，也不依赖系统 Node 运行 terminal。
- Codex 未安装时 Settings 给出明确诊断；选择外部 Codex 后可以启动。
- 干净 VM 执行安装、启动、多 Run、终端、Workflow、升级和卸载场景。

## 17. 本期验收标准

以下全部通过才算本期完成：

1. 一个项目可创建至少 3 个 Run，每个 Run 有独立 snapshot、phase_dir、revision。
2. 代码修改型 Run 均有独立 worktree，任何失败都不会静默使用共享项目根。
3. UI 可以选择任意 Run，刷新后恢复 selected Run。
4. Workflow、Gates、Artifacts、Terminal 页面都显示并操作显式 Run。
5. Run A 和 Run B 可以同时运行独立 Codex PTY session。
6. 切换 Run 不会终止、重绑定或混合已有 session。
7. 同一 Run 当前节点不能启动两个活动 Codex session。
8. Codex 路径可以自动发现或手动选择，错误 WindowsApps 候选不会阻止使用可用 Hermes binary。
9. Packaged app 中 Codex TUI 的输入、ANSI 输出、中文、粘贴、resize、Ctrl+C、停止和重启正常。
10. Renderer 没有直接 Node、Shell、文件系统或任意 spawn 权限。
11. 用户可显式完成普通节点，Runtime 必须校验 artifact 和 revision。
12. Confirmation 节点必须人工决定；Gate 权限不得由终端绕过。
13. Gate required artifacts 来自项目配置，自定义 Gate 和 waiver 可用。
14. Gate 失败按当前 Run 路由回退，超过上限进入 BLOCKED。
15. Workflow Studio 可以创建和编辑自定义节点、role、artifact、Gate 和所有 Intent/Risk route。
16. Workflow Studio 可以编辑 failure recovery、查看 effective hard rules、Undo/Redo。
17. YAML/ZIP 导入导出、semantic diff、apply、版本列表和恢复全部可用。
18. 非法 Workflow 不会落盘；合法 Workflow 只影响新 Run。
19. Desktop/Runtime 退出不会自动完成节点，session 有可诊断 interrupted 状态。
20. 聚焦测试、全量测试、真实 Codex smoke、并行 Run E2E、Workflow E2E、打包 smoke 和干净 Windows VM 验收均有证据。

## 18. 回滚与兼容

- 保留现有 `.harness` v1 文件结构，不迁移到 v2。
- 旧项目没有 terminal session 表时自动创建可重建投影，不修改项目状态。
- `activeRun` 迁移期间提供兼容 selector，但新代码统一写 `selectedRunId`。
- 根 state projection 继续更新，保证 CLI/旧版本 Desktop 可读取当前 selected Run。
- Workflow apply 前保存旧版本和 hash；失败后原子保持旧文件。
- node-pty 或 Terminal UI 发布失败时，可 feature flag 隐藏终端入口并回滚 Desktop，不影响项目 Run state。
- app-server 旧代码不删除，主 UI 不再调用；需要回退时只能作为诊断实验入口，不能同时管理同一 Run。

## 19. 风险与对策

| 风险 | 对策 |
| --- | --- |
| Electron/node-pty ABI 或打包失败 | 固定兼容版本，Forge rebuild，asarUnpack 原生模块，packaged smoke 覆盖真实 PTY。 |
| 多 Run 同时修改同一目录 | 代码修改 Run 强制独立 worktree；无法创建则阻断。 |
| 终端输出串到错误 Run | session 强绑定四元组并在每个事件带 ownership 字段；Renderer 丢弃不匹配事件。 |
| WindowsApps 假 Codex 路径 | 枚举全部候选并逐个直接 probe；保存实际成功的绝对路径。 |
| 用户误把终端退出当节点完成 | 终端状态和 Run 节点状态分离，退出后仍显示“Node not completed”。 |
| Workflow UI 写坏项目配置 | Runtime 二次完整校验、expected hash、项目锁、原子替换和版本回滚。 |
| 原始终端日志泄露 secret | 默认仅本机滚动缓存、大小限制、脱敏、诊断导出二次确认。 |
| 工作范围过大导致半成品发布 | 按工作包顺序集成，但统一使用本节 20 条验收标准；缺任何强制项不标记本期完成。 |

## 20. 候选知识

| 类型 | 标题 | 相对原设计的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- |
| adr | Codex 主链路采用 Run-bound PTY terminal | 用户明确不需要 app-server 深度事件集成，而需要 Harness 中直接运行 Codex 命令和 TUI。 | 本 Run 用户确认；上一审计确认 app-server 链路与真实需求不一致。 | 后续人工 review 后写入 `doc/desktop-architecture.md` 执行器章节。 |
| rule | 多 Run 业务 API 必须显式携带 runId | 单一 activeRun 不能支持并行 session；根 state 只能是 selected Run 投影。 | 当前 WorkspaceContext 只有 activeRun；Run snapshot 已具备独立权威状态。 | 后续人工 review 后写入 `.harness` 项目规则或架构状态事务章节。 |
| rule | 并行代码修改 Run 必须独立 worktree | 多 PTY/Codex 在共享项目根并行修改会产生不可控覆盖。 | 当前 DEVELOPMENT 已有 worktree 基础，但其他并行路径未强制。 | 后续人工 review 后写入执行和安全规则。 |
| pattern | Terminal session 与 Run/Node 四元组绑定 | 切换 UI selected Run 不应改变后台执行归属。 | 本方案 TerminalSession 数据模型和 ownership IPC。 | 后续人工 review 后写入 Desktop execution pattern。 |
| rule | 终端退出不能自动完成 Harness 节点 | 原生 Codex 进程退出不证明 artifact、确认或 Gate 已满足。 | 当前设计的节点/Gate 约束；用户选择终端模式。 | 后续人工 review 后写入 node lifecycle 规则。 |

## 21. 不建议沉淀的内容

- 本机 Hermes Codex 的完整绝对路径：属于单机安装细节，不是可移植规则。
- 一次性的 Access denied 命令输出：只保留“候选必须逐个 probe”的可复用结论。
- 未运行的测试或打包结果：本文是方案，不构成实现和发布证据。
- app-server 的未来 Gateway/MCP 推测：已明确不属于本期主路径。

## 22. 待用户确认

- 本方案已按用户要求把全部核心能力列为同一期强制交付，不自动写入长期知识库。
- 后续实施应创建独立 `FEATURE / HIGH` Run，并以第 17 节 20 条验收标准作为不可拆分的本期完成定义。
