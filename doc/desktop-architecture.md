# Harness Desktop 最终架构方案

## 1. 文档状态

- 状态：最终方案
- 日期：2026-07-21
- 目标项目：`D:\projects\person\harness-desktop`
- 首发平台：Windows 10/11
- 首发执行器：Codex
- 项目协议：严格兼容 `.harness` v1.0
- 约束事实源：`harness-main` 当前发布模板中的 `state.schema.json`、`workflow.yaml`、`evals/gates.yaml`、角色与规则文件

## 2. 产品定位

Harness Desktop 是一个独立的 AI Coding 流程治理、可视化编排和外部执行器管理桌面软件。它把 `.harness` 中原本依靠文件和 Agent 指令执行的约束，转化为可观察、可审批、可恢复、可审计的桌面工作台。

Desktop 负责项目与 Run 管理、Workflow 编译、节点推进、人工确认、Gate 评估、执行器编排、权限审批、证据展示和崩溃恢复；Codex 等外部 Coding Agent 负责具体分析与开发。Desktop 不实现自己的模型推理循环，也不允许 Renderer、执行器或用户界面绕过 Runtime 直接修改权威状态。

## 3. 核心设计决策

### 3.1 项目协议不重写

首发版不在项目中引入 `project.yaml`、`events/<run>.jsonl` 或新的 Run 目录协议。项目侧仍使用：

```text
.harness/
  state.json
  state.schema.json
  workflow.yaml
  evals/gates.yaml
  agents/*.md
  rules/*.md
  context/*.md
  phases/<run-id>/*
  runs/<run-id>/state.json
  knowledge/*
```

`.harness/state.json` 是当前活动 Run 的唯一状态事实源；`state.phase_dir` 是阶段产物唯一写入位置；`runs/<run-id>/state.json` 是每次状态变更后的快照。Desktop 的 SQLite、事件流和缓存都是可重建派生数据，不参与项目状态裁决。

### 3.2 独立实现，通过协议兼容

`harness-desktop` 不 import、复制或通过相对路径调用 `harness_cli` 源码。Desktop Runtime 独立实现 `.harness` v1.0 Protocol Adapter，并用来自权威模板的 fixture/contract tests 防止行为漂移。

### 3.3 自定义编排不等于绕过约束

用户可以编排节点、角色、产物、Gate、路由和失败回退，但系统最低规则不可删除。最终执行规则为：

```text
effective_rules = system_minimum_rules ∪ project_hard_rules
```

自定义规则可以更严格，不能削弱系统安全底线。首发只支持有序线性路由；DAG、并行节点、循环、运行时动态分支和多 Agent 并发属于未来 `.harness` v2。

### 3.4 活动 Run 路由冻结

创建 Run 时，将编译后的路由写入 `state.required_nodes`。之后修改 `workflow.yaml` 只影响新 Run，不自动改变活动 Run。迁移活动 Run 必须通过显式 CHANGE_REQUEST，展示差异、重新校验并保存快照。

## 4. 目标与非目标

### 4.1 首发目标

1. 导入或初始化 `.harness` v1.0 项目。
2. 用户明确选择 Intent/Risk 并创建安全 Run。
3. 可视化默认和自定义 Workflow。
4. 严格执行节点、角色、Gate、回退和重试约束。
5. 启动 Codex 执行当前节点并呈现实时事件。
6. 处理文件、命令、网络和高风险操作审批。
7. 展示阶段产物、证据、门禁和审计记录。
8. 应用或 Runtime 崩溃后恢复项目与执行器会话。
9. 在 Windows 上完成安装、升级、卸载和诊断导出。

### 4.2 首发非目标

- 内置代码编辑器；
- 团队云服务；
- 通用插件市场；
- 自研模型调用和上下文压缩；
- 多 Agent 自主协作；
- 并行/DAG Workflow；
- 自动绕过审批、节点或 Gate；
- 在未迁移协议的情况下写入 `.harness` v2 文件。

## 5. `.harness` v1.0 兼容模型

### 5.1 State 关键约束

- `run_id`：1–64 位，匹配 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`。
- Intent：`UNKNOWN | QUERY | BUG_FIX | FEATURE | REFACTOR | DEPLOYMENT | INCIDENT`。
- Risk：`UNKNOWN | NA | LOW | MEDIUM | HIGH`。
- `phase_dir`：必须匹配 `.harness/phases/<safe-run-id>`，解析后仍位于 phases 根目录。
- `required_nodes`、`completed_nodes`：唯一字符串集合；进度只统计两者交集。
- Gate 状态：`PASS | FAIL | WAIVED | BLOCKED | NOT_REQUIRED | NOT_RUN`。
- `retry_counts`：非负整数；单 Gate 自动重试上限为 2。

### 5.2 22 个内置节点

| 顺序 | Node ID | 默认角色 | 默认产物 |
| --- | --- | --- | --- |
| 1 | INTAKE | dispatcher | `00-intake.md` |
| 2 | CONTEXT_PACK | requirement-analyst | `00-context-pack.md` |
| 3 | REQUIREMENT_REVIEW | requirement-analyst | `01-requirement-review.md` |
| 4 | REQUIREMENT_CONFIRMATION | orchestrator | `02-requirement-confirmation.md` |
| 5 | SOLUTION_DESIGN | tech-architect | `03-solution-design.md` |
| 6 | SOLUTION_CONFIRMATION | orchestrator | `04-solution-confirmation.md` |
| 7 | PRE_MORTEM | quality-guardian | `05-pre-mortem.md` |
| 8 | IMPLEMENTATION_PLAN | plan-generator | `06-implementation-plan.md` |
| 9 | ACCEPTANCE_CONFIRMATION | orchestrator | `07-acceptance-confirmation.md` |
| 10 | CHANGE_REQUEST | state-keeper | `08-change-request.md` |
| 11 | BRANCH_CREATION | state-keeper | `09-branch.md` |
| 12 | WORKTREE_CREATION | state-keeper | `10-worktree.md` |
| 13 | CODING_DESIGN_CONFIRMATION | developer | `10-coding-design.md` |
| 14 | DEVELOPMENT | developer | `11-development.md` |
| 15 | COMPILE | verifier | `12-compile.md` |
| 16 | UNIT_TEST | verifier | `13-unit-test.md` |
| 17 | ATDD | verifier | `14-atdd.md` |
| 18 | EVIDENCE_CAPTURE | verifier | `15-evidence.json` |
| 19 | PRERELEASE_DEPLOYMENT | deployer | `16-prerelease-deployment.md` |
| 20 | INTERFACE_TEST | tester | `17-interface-test.md` |
| 21 | ACCEPTANCE_REPORT | orchestrator | `18-acceptance-report.md` |
| 22 | KNOWLEDGE_PROMOTION | knowledge-keeper | `19-knowledge-promotion.md` |

Desktop 不把这 22 个节点硬编码为唯一节点集合，而是把它们作为内置 Node Catalog。项目可以新增自定义 Node ID，但必须满足唯一性、角色存在、产物安全、Gate 引用有效和线性路由可编译等条件。

### 5.3 系统最低规则

- 代码变更路由必须包含 COMPILE、UNIT_TEST、EVIDENCE_CAPTURE。
- HIGH 必须包含 REQUIREMENT_CONFIRMATION、SOLUTION_CONFIRMATION、PRE_MORTEM、ACCEPTANCE_CONFIRMATION。
- HIGH 或 DEPLOYMENT 必须包含 PRERELEASE_DEPLOYMENT、INTERFACE_TEST。
- `intent`、`risk` 只能由用户创建 Run 时指定，Desktop 和执行器不得覆盖。
- Dispatcher 选择的 required node 不得被跳过。
- 所有阶段产物必须写入 `state.phase_dir`。
- G3–G8 只能由 verifier 权限域写入。
- Gate 失败按 `failure_recovery.gate_to_node` 回退；超过 2 次进入 BLOCKED。
- KNOWLEDGE_PROMOTION 只生成候选草稿；写入长期知识库必须人工 review/accept。

### 5.4 Gate 兼容语义

Desktop 读取 `gates.yaml` 的 description、required_artifacts 和 pass_conditions。`pass_conditions` 是面向人的检查说明，不执行自然语言关键词猜测。确定性检查包括：

1. required artifact 必须存在、是普通文件且非空；
2. phase_dir 和 artifact 路径不得越界；
3. state 标记 PASS 但确定性检查失败时，显示并持久化 FAIL；
4. G6 Evidence 必须是合法 JSON，并包含 `run_id`、`intent`、`risk`、`changed_files`、`commands`、`gates`、`artifacts`、`waivers`、`residual_risks`；
5. WAIVED 必须包含 scope、reason、owner 和时间；
6. 自定义 Gate 首发只支持“产物存在且非空”的确定性检查；结构化自定义检查 DSL 留到协议 v1.1/v2。

## 6. 功能范围

### 6.1 项目与 Run

- 导入、初始化、注册、取消注册和重新定位项目；
- 协议健康检查、只读兼容模式和模板修复；
- 新建、查看、筛选、切换、暂停、恢复和保存 Run；
- 显示进度、当前节点、下一角色、阻塞、重试和快照状态；
- 检测外部修改、并发写入和目录丢失。

### 6.2 Workflow Studio

- 从内置模板创建、复制、导入和导出 Workflow；
- 拖拽添加、删除、复制和排序节点；
- 编辑 Node ID、角色、产物和 Gate；
- 按 Intent/Risk 编辑路由；
- 编辑 failure recovery 和项目 hard rules；
- 显示不可删除的系统最低节点；
- 编译、模拟、diff、应用和恢复历史版本；
- 修改只影响新 Run，活动 Run 迁移必须走 CHANGE_REQUEST。

### 6.3 执行、审批与恢复

- 探测、启动、流式读取、取消和恢复 Codex；
- 只组装当前节点需要的角色、规则、上下文和产物；
- 统一展示文件写入、命令、网络、目录外访问、部署和危险 Git 请求；
- 支持允许一次、拒绝和受控前缀授权；
- Runtime 异常、子进程异常和系统重启后恢复。

### 6.4 Gate、Artifact 与知识

- G1–G8 和自定义 Gate 面板；
- 产物 Markdown/JSON 预览、哈希和安全检查；
- 失败回退、重试、BLOCKED 和解除阻塞；
- Evidence、验收报告和诊断包导出；
- KNOWLEDGE_PROMOTION 草稿查看、逐条 review/accept；
- 后续支持共享知识 Git pull/push 和冲突处理。

## 7. 总体架构

```text
┌──────────────── React Renderer ────────────────┐
│ Projects │ Runs │ Workflow Studio │ Execution │
│ Gates │ Artifacts │ Audit │ Knowledge │ Settings│
└───────────────────┬────────────────────────────┘
                    │ Typed Preload API
┌──────────────── Electron Main ─────────────────┐
│ Window │ Native Dialog │ Keychain │ Updater    │
│ Runtime Supervisor │ Process/Path Capability   │
└───────────────────┬────────────────────────────┘
                    │ localhost + one-time token
                    │ JSON-RPC / WebSocket
┌──────────────── Python Harness Runtime ────────┐
│ Protocol Adapter │ Workflow Compiler           │
│ Run Service │ Dispatcher │ Gate Engine          │
│ Atomic State Store │ Artifact Service           │
│ Approval Service │ Executor Manager             │
│ Recovery Service │ Audit Projection             │
└───────────────┬───────────────┬─────────────────┘
                │               │
        项目 .harness/   AppData SQLite / logs
                │
           Codex 子进程
```

## 8. 组件权责

### 8.1 Electron Main

Electron 是 OS 能力入口，负责窗口、文件选择、通知、Keychain、更新、Runtime 生命周期和受控子进程能力。它不实现 Workflow、Run 或 Gate 逻辑。Preload 只暴露类型化业务 API，不暴露通用 `exec`、`readFile`、`writeFile`。

### 8.2 React Renderer

Renderer 只负责页面、表单、可视化、服务端状态缓存和短期交互状态。Renderer 不直接访问 Node.js、Shell、SQLite 或项目文件；所有写入通过 Runtime command，并携带 expected revision。

### 8.3 Harness Runtime

Runtime 是业务写入的唯一入口：

- `ProtocolAdapter`：加载、校验和序列化 `.harness` v1.0；
- `WorkflowCompiler`：合并系统规则和项目规则，生成可执行线性路由；
- `RunService`：创建、切换和快照 Run；
- `Dispatcher`：选择第一个未完成 required node；
- `GateEngine`：确定性检查、权限校验、失败回退和重试；
- `AtomicStateStore`：锁、预期版本、Schema 校验、临时文件、fsync、原子替换和 snapshot；
- `ArtifactService`：安全路径、预览、哈希和变更检测；
- `ExecutorManager`：执行器探测、会话、流式事件、取消和恢复；
- `ApprovalService`：授权决策和高风险动作约束；
- `AuditProjection`：把 Runtime 事件投影到 SQLite；
- `RecoveryService`：重启恢复、孤儿进程和临时文件处理。

## 9. 自定义编排架构

### 9.1 三层模型

1. `NodeCatalog`：内置节点、自定义节点、角色和 Gate 元数据。
2. `WorkflowDraft`：Renderer 中的未保存草稿，可撤销/重做。
3. `CompiledWorkflow`：通过全部检查后物化为项目 `.harness/workflow.yaml`。

### 9.2 编译检查

Workflow 保存前必须检查：

- Node ID 唯一；
- 角色文件存在；
- artifact 是安全相对文件名；
- Gate 已定义；
- routes 中节点全部存在且无重复；
- 每个支持的 Intent/Risk 都有合法路线；
- effective hard rules 全部满足；
- failure recovery 引用有效且不会无限回退；
- 路由存在终止节点；
- 自定义角色没有越权 Gate 权限；
- v1 模式没有并行、循环或条件表达式。

编译失败只返回诊断，不写项目文件。编译成功后先展示 semantic diff，用户确认后获取项目锁并原子替换 `workflow.yaml`。

### 9.3 版本与移植

Workflow 版本、内容哈希、作者和变更摘要存入 AppData SQLite；项目仍只保存当前 `workflow.yaml`。导出格式是包含 workflow、相关 agent 和 gate 文件的受签名/哈希校验 ZIP，不允许绝对路径或 `..` 条目。

## 10. 状态事务与并发

每次状态修改采用：

```text
接收 command + expected_revision
→ 验证本机 token、项目授权和角色权限
→ 获取项目独占锁
→ 重新读取 state.json 并比较 revision/hash
→ 执行业务不变量和 Schema 校验
→ 写同目录临时文件并 flush/fsync
→ os.replace 原子替换 state.json
→ 原子更新 runs/<run-id>/state.json
→ 提交 SQLite 审计投影
→ 广播 StateChanged
→ 释放锁
```

若项目文件被 CLI 或其他窗口修改，Runtime 返回 `REVISION_CONFLICT`；UI 必须刷新并让用户重新提交，不能 last-write-wins。

## 11. Runtime 通信协议

Runtime 只监听 `127.0.0.1` 随机端口。Electron 启动时生成一次性 token，通过受控环境变量或匿名管道传递；握手校验 Desktop/Runtime/Project Protocol 三个版本。

核心 JSON-RPC 方法：

```text
runtime.health
project.list / project.import / project.validate / project.repair
workflow.get / workflow.compile / workflow.apply / workflow.simulate
run.list / run.create / run.switch / run.pause / run.resume
node.start / node.confirm / node.reject
gate.list / gate.evaluate / gate.waive
artifact.list / artifact.read / artifact.hash
executor.probe / executor.start / executor.cancel / executor.recover
approval.respond
audit.query / diagnostics.export
```

WebSocket 事件：`StateChanged`、`WorkflowChanged`、`ExecutionOutput`、`ToolCall`、`ApprovalRequested`、`GateEvaluated`、`ArtifactChanged`、`ExecutorExited`、`RuntimeWarning`。

所有 command 使用 `request_id` 保证幂等，并携带 `project_id`、`run_id`、`expected_revision` 和调用者权限域。

## 12. 执行器接口

```typescript
interface ExecutorAdapter {
  probe(): Promise<ExecutorCapability>;
  start(request: ExecutionRequest): Promise<SessionId>;
  stream(sessionId: SessionId): AsyncIterable<ExecutionEvent>;
  respond(sessionId: SessionId, decision: UserDecision): Promise<void>;
  cancel(sessionId: SessionId): Promise<void>;
  recover(sessionId: SessionId): Promise<RecoveryResult>;
}
```

`ExecutionRequest` 只包含项目根、Run 快照、当前节点、当前角色文件、必要规则/上下文、phase_dir 和授权策略。Runtime 不预读整套 Harness，不把敏感 token 写入项目产物。

## 13. 数据归属

| 数据 | 权威位置 | 可否重建 |
| --- | --- | --- |
| 当前 Run 状态 | 项目 `.harness/state.json` | 否 |
| Run 快照 | 项目 `.harness/runs/<id>/state.json` | 部分 |
| 阶段产物 | 项目 `state.phase_dir` | 否 |
| Workflow/Gate/Agent | 项目 `.harness` | 否 |
| 项目注册列表 | AppData SQLite | 是 |
| Workflow 历史/哈希 | AppData SQLite | 是 |
| Executor 会话 | AppData SQLite | 部分 |
| 审计投影 | AppData SQLite | 是 |
| UI 设置与缓存 | AppData | 是 |
| API Key/token | OS Keychain | 否 |

Windows 应用目录建议为 `%LOCALAPPDATA%\HarnessDesktop\`，包含 `runtime.db`、`logs/`、`cache/`、`updates/` 和 `diagnostics/`。

## 14. 安全模型

- Electron `contextIsolation=true`、`nodeIntegration=false`、启用 sandbox；
- CSP 禁止任意脚本和远程代码；
- Renderer 不持有 Runtime token；
- 项目必须由用户选择或显式注册；
- 所有路径 canonicalize 后验证仍在授权根目录；
- 禁止符号链接/junction 逃逸；
- run_id、Node ID、Gate ID、文件名使用白名单；
- 命令、网络、目录外访问、部署、删除、权限和危险 Git 操作进入审批；
- Secret 存 OS Keychain，日志和诊断包脱敏；
- SQLite 使用参数化查询；
- 导入模板防 Zip Slip、超大压缩包和恶意符号链接；
- Runtime token 短时有效，监听 loopback，协议握手失败立即退出。

## 15. 页面信息架构

1. **Projects**：项目健康度、协议版本、当前 Run、阻塞和导入/初始化。
2. **Runs**：创建、筛选、切换、暂停、恢复和快照。
3. **Workflow**：当前路由时间线、角色、产物、Gate 和下一步原因。
4. **Workflow Studio**：节点目录、路由编辑、Gate/角色配置、模拟、diff 和版本。
5. **Execution**：日志、工具调用、审批、耗时、取消和恢复。
6. **Approvals**：待处理与历史授权。
7. **Gates**：G1–G8、自定义 Gate、证据、失败、回退和重试。
8. **Artifacts**：Markdown/JSON 预览、哈希、打开目录和安全状态。
9. **Audit**：按项目、Run、节点、事件和时间筛选。
10. **Knowledge**：候选草稿、review/accept、搜索和后续 Git 同步。
11. **Settings/Diagnostics**：Codex、Runtime、Keychain、日志、更新和诊断导出。

## 16. 崩溃恢复

启动时 Runtime：

1. 扫描注册项目并只读验证协议；
2. 检查 state 与 snapshot、一致性和残留临时文件；
3. 查询未结束 ExecutorSession；
4. 探测对应子进程是否仍存活；
5. 对可恢复会话重新订阅，对孤儿进程提供终止或接管，对丢失会话记录异常退出；
6. 不自动把未完成节点标记完成；
7. 所有恢复决定写入审计投影。

## 17. 测试策略

- **Contract**：TypeScript JSON Schema、Python Pydantic 与权威 `.harness` fixture 一致；
- **Protocol**：有效/无效 state、workflow、gates、agent 和路径 fixture；
- **Workflow Compiler**：系统规则合并、路由、未知引用、无限回退和活动 Run 冻结；
- **State Store**：原子写、锁、revision conflict、故障注入和 snapshot；
- **Gate**：空文件、越界、Evidence 九字段、权限和 retry/block；
- **Executor**：Codex 缺失、启动、流式输出、审批、取消、超时和恢复；
- **Integration**：Electron 启动 Runtime、token 握手和 typed preload；
- **E2E**：导入项目、创建 Run、自定义 Workflow、执行节点、审批、失败回退、重启恢复；
- **Security**：路径穿越、junction、Zip Slip、CSP、Renderer 越权和日志脱敏；
- **Packaging**：Windows 安装、升级、卸载、首次启动和离线 Runtime。

权威兼容 fixture 从已发布 Harness 模板复制到仓库，CI 对其版本和哈希进行显式更新审核，不在测试时依赖相邻 `harness-main` 目录。

## 18. 技术栈

- Electron Forge + TypeScript；
- React + Vite；
- Zustand 或等价轻量 UI 状态；
- TanStack Query 管理 Runtime 查询缓存；
- React Flow 用于 Workflow Studio；
- Python 3.11 Runtime；
- FastAPI/Uvicorn 提供 loopback JSON-RPC/WebSocket；
- Pydantic + JSON Schema；
- SQLite（Python stdlib）保存派生数据；
- PyInstaller 打包 Runtime；
- Vitest、pytest、Playwright；
- pnpm workspace。

## 19. 分阶段交付

### Phase 1：协议与桌面骨架

Electron/React/Python Runtime、认证握手、项目导入、v1 Schema 校验、项目列表、Run 创建和只读 Workflow。

### Phase 2：状态机与门禁

AtomicStateStore、锁与 revision、Dispatcher、GateEngine、Artifact/Evidence、失败回退和审计投影。

### Phase 3：自定义编排

Workflow Studio、Node Catalog、编译器、模拟、diff、版本、导入导出和活动 Run 冻结。

### Phase 4：Codex 与审批

Codex Adapter、流式事件、权限审批、取消、超时、恢复和诊断。

### Phase 5：知识与 Windows 发布

知识候选 review/accept、安装包、Runtime 打包、签名、自动更新、迁移和完整 E2E。

## 20. 首发验收标准

1. Windows 用户可以安装并启动 Desktop，Renderer 无 Node/Shell 权限。
2. 可以导入权威 `.harness` v1.0 fixture，非法协议得到精确诊断。
3. 可以创建用户指定 Intent/Risk 的安全 Run，路由满足全部系统最低规则。
4. 可以编辑并编译自定义线性 Workflow；非法编排无法写入项目。
5. Workflow 修改不改变已启动 Run 的 `required_nodes`。
6. 可以从当前节点启动 Codex，查看日志、工具和审批请求。
7. 所有状态变更经锁、revision、Schema、原子替换和 snapshot。
8. G3–G8 非 verifier 调用被拒绝；无效产物不能保持 PASS。
9. Gate 失败按映射回退，第三次失败进入 BLOCKED。
10. 应用重启后恢复项目、Run、节点和可恢复执行器会话。
11. SQLite 删除后可从项目协议重建核心索引，不影响项目状态。
12. Windows 安装、升级、卸载和诊断导出测试通过。

## 21. 未来协议演进

`.harness` v2 可考虑原生 Workflow DAG、并行节点、条件表达式、结构化 Gate DSL、项目内追加事件日志和多 Agent 编排。v2 必须具备独立 Schema、迁移工具、备份、dry-run、回滚和双版本兼容期；Desktop 首发不得以内部需求为由静默写入 v2 格式。
