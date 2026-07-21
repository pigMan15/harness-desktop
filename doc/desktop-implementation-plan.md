# Harness Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Windows 首发、严格兼容 `.harness` v1.0、支持安全自定义线性编排并可驱动 Codex 的 Harness Desktop。

**Architecture:** Electron Main 管理本机能力和 Python Runtime 生命周期，React Renderer 只通过类型化 Preload API 访问业务能力，Python Runtime 是 `.harness` 唯一写入入口。项目文件保持 v1.0 权威协议，SQLite 只保存可重建索引、执行器会话和审计投影。

**Tech Stack:** pnpm workspace、Electron Forge、React、TypeScript、Vite、React Flow、Python 3.11、FastAPI/Uvicorn、Pydantic、SQLite、PyInstaller、Vitest、pytest、Playwright。

---

## 1. 实施原则

1. 每个任务先写失败测试，再实现最小可用行为。
2. 每个里程碑结束时都必须产生可运行软件，而不是只搭空目录。
3. Runtime 不依赖相邻 `harness-main` 源码；兼容性由仓库内冻结 fixture 验证。
4. Renderer 不直接访问文件系统、Shell、SQLite 或 Runtime token。
5. 所有项目写入都经过项目锁、expected revision、Schema 校验、原子替换和 snapshot。
6. 自定义编排只支持 v1 可表达的线性 routes；系统最低规则不可删除。
7. 每个任务完成后运行聚焦测试；每个 Phase 完成后运行全量测试和 Electron smoke test。

## 2. 目标目录结构

```text
harness-desktop/
  apps/
    desktop/
      src/main/
      src/preload/
      tests/
    renderer/
      src/app/
      src/features/
      src/components/
      tests/
  runtime/
    pyproject.toml
    src/harness_runtime/
      api/
      contracts/
      protocol/
      workflow/
      runs/
      gates/
      artifacts/
      executors/
      approvals/
      persistence/
      recovery/
    tests/
  packages/
    contracts/
    ui/
  schemas/
  fixtures/harness-v1/
  tests/e2e/
  docs/architecture/
  pnpm-workspace.yaml
  package.json
```

## Phase 0：仓库与开发基线

### Task 0.1：初始化独立仓库与工作区

**Files:**
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `runtime/pyproject.toml`
- Create: `README.md`

- [ ] 初始化 Git 并创建开发分支。

```powershell
git init
git checkout -b codex/desktop-foundation
```

- [ ] 创建 pnpm workspace。

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] 在根 `package.json` 定义统一命令：`lint`、`typecheck`、`test`、`test:e2e`、`build`、`package`。
- [ ] 在 `runtime/pyproject.toml` 声明 Python `>=3.11,<3.13`，开发依赖包含 pytest、pytest-cov、ruff、mypy。
- [ ] 验证空工作区命令可以运行。

Run:

```powershell
pnpm install
python -m pip install -e ".\runtime[dev]"
pnpm typecheck
python -m pytest runtime/tests -q
```

Expected: 命令退出码均为 0，允许初始测试数为 0，但不得出现配置错误。

- [ ] Commit。

```powershell
git add .
git commit -m "chore: initialize harness desktop workspace"
```

### Task 0.2：CI 与质量基线

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `ruff.toml`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`

- [ ] CI 使用 Windows runner，安装 Node、pnpm、Python 3.11。
- [ ] CI 顺序执行格式、lint、typecheck、pytest、Vitest、build。
- [ ] 将 Runtime 覆盖率阈值设为 85%，核心 protocol/workflow/state/gate 设为 95%。
- [ ] 提交一个故意失败的 fixture 测试验证 CI 能阻断，再恢复并确认通过。
- [ ] Commit：`chore: add desktop continuous integration`。

## Phase 1：契约、Runtime 与桌面骨架

### Task 1.1：冻结 `.harness` v1.0 兼容 fixture

**Files:**
- Create: `fixtures/harness-v1/valid-project/.harness/**`
- Create: `fixtures/harness-v1/invalid-*/.harness/**`
- Create: `schemas/state.schema.json`
- Create: `schemas/rpc.schema.json`
- Create: `runtime/tests/contract/test_harness_v1_fixtures.py`

- [ ] 从已发布模板复制 state/workflow/gates/agent/rule fixture，不在测试时引用相邻仓库。
- [ ] 建立无效 fixture：非法 run_id、phase 越界、重复节点、未知角色、未知 Gate、违反 hard rule、无限回退、Evidence 缺字段。
- [ ] 先写参数化失败测试：有效 fixture 必须通过，无效 fixture 必须返回稳定 error code 和 JSON Pointer。
- [ ] 实现最小 fixture loader 后运行：

```powershell
python -m pytest runtime/tests/contract/test_harness_v1_fixtures.py -v
```

Expected: 全部 fixture 分类正确。

- [ ] Commit：`test: freeze harness v1 compatibility fixtures`。

### Task 1.2：共享 RPC 契约

**Files:**
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/rpc.ts`
- Create: `runtime/src/harness_runtime/contracts/models.py`
- Create: `runtime/tests/contract/test_rpc_schema.py`
- Create: `packages/contracts/tests/rpc.test.ts`

- [ ] 定义 `RpcRequest`、`RpcResponse`、`RpcError`、`RuntimeEvent`、`ProjectSummary`、`RunStateDto`、`WorkflowDiagnostic`。
- [ ] 所有 command 包含：

```typescript
interface CommandMeta {
  requestId: string;
  projectId: string;
  runId?: string;
  expectedRevision?: string;
}
```

- [ ] Python Pydantic 与 TypeScript 类型都从同一 JSON Schema 验证示例 payload。
- [ ] 先加入字段缺失、未知 enum、版本不匹配的失败测试。
- [ ] Run：`pnpm --filter @harness/contracts test` 和 `python -m pytest runtime/tests/contract/test_rpc_schema.py -v`。
- [ ] Commit：`feat: define runtime rpc contracts`。

### Task 1.3：Runtime 健康检查与认证握手

**Files:**
- Create: `runtime/src/harness_runtime/main.py`
- Create: `runtime/src/harness_runtime/api/app.py`
- Create: `runtime/src/harness_runtime/api/auth.py`
- Create: `runtime/tests/api/test_health_auth.py`

- [ ] 写测试证明无 token、错误 token 和协议不兼容均被拒绝。
- [ ] Runtime 绑定 `127.0.0.1:0`，从环境读取一次性 token。
- [ ] 实现 `runtime.health` 返回 Desktop、Runtime、Project Protocol 版本和进程信息。
- [ ] Run：`python -m pytest runtime/tests/api/test_health_auth.py -v`。
- [ ] Commit：`feat: add authenticated local runtime`。

### Task 1.4：Electron Main、Preload 与 Renderer 壳

**Files:**
- Create: `apps/desktop/**`
- Create: `apps/renderer/**`
- Create: `apps/desktop/src/main/runtime-supervisor.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/tests/security.test.ts`

- [ ] 配置 Electron Forge + Vite，启用 `contextIsolation`、sandbox，关闭 `nodeIntegration`。
- [ ] 先写测试确保 `window.require`、通用 exec/readFile/writeFile 均不可用。
- [ ] `RuntimeSupervisor` 启动 Python，读取握手端口，完成 token 校验，异常退出时发事件。
- [ ] Preload 只暴露 `window.harness.health()` 和事件订阅。
- [ ] Renderer 显示 Runtime healthy/unavailable 页面。
- [ ] Run：`pnpm --filter @harness/desktop test`、`pnpm --filter @harness/desktop dev`。
- [ ] Commit：`feat: create secure electron runtime shell`。

## Phase 2：项目协议与安全状态存储

### Task 2.1：Protocol Adapter

**Files:**
- Create: `runtime/src/harness_runtime/protocol/models.py`
- Create: `runtime/src/harness_runtime/protocol/loader.py`
- Create: `runtime/src/harness_runtime/protocol/validator.py`
- Test: `runtime/tests/protocol/test_loader_validator.py`

- [ ] 建立 `HarnessState`、`WorkflowDefinition`、`NodeDefinition`、`GateDefinition` 模型。
- [ ] 加载 UTF-8 JSON/YAML，并将 YAML 语法错误、Schema 错误和引用错误转为稳定 diagnostics。
- [ ] 路径解析使用 `Path.resolve()` + `relative_to()`，额外拒绝 symlink/junction 逃逸。
- [ ] 校验 state gates 完整、completed 是 required 子集、artifact 和 phase 安全。
- [ ] Run：`python -m pytest runtime/tests/protocol -v`。
- [ ] Commit：`feat: implement harness v1 protocol adapter`。

### Task 2.2：项目注册与导入

**Files:**
- Create: `runtime/src/harness_runtime/projects/service.py`
- Create: `runtime/src/harness_runtime/persistence/database.py`
- Create: `runtime/src/harness_runtime/persistence/migrations/001_initial.sql`
- Create: `apps/renderer/src/features/projects/**`
- Test: `runtime/tests/projects/test_project_service.py`

- [ ] SQLite 创建 projects、workflow_versions、executor_sessions、audit_events、request_dedup 表。
- [ ] 项目导入前验证用户选择路径和 `.harness` 健康度。
- [ ] 非 Harness 项目只能在用户确认后从内置 v1 模板初始化。
- [ ] 协议不兼容项目以 read-only 状态返回。
- [ ] Renderer 实现项目列表、导入、初始化、取消注册和健康诊断。
- [ ] Run：pytest projects tests + renderer Vitest。
- [ ] Commit：`feat: add project registry and import flow`。

### Task 2.3：Atomic State Store 与项目锁

**Files:**
- Create: `runtime/src/harness_runtime/persistence/atomic_files.py`
- Create: `runtime/src/harness_runtime/persistence/project_lock.py`
- Create: `runtime/src/harness_runtime/persistence/state_store.py`
- Test: `runtime/tests/persistence/test_state_store.py`

- [ ] 先写故障注入测试：replace 失败保留旧文件、临时文件清理、并发 revision 冲突、snapshot 失败不报告成功。
- [ ] 实现同目录临时文件、flush、fsync、`os.replace`。
- [ ] `write_state(command, expected_revision)` 在锁内重新读取和校验。
- [ ] 成功后更新 `runs/<run-id>/state.json`，返回新 revision/hash。
- [ ] Windows 使用命名 mutex 或锁文件；超时返回 `PROJECT_LOCK_TIMEOUT`。
- [ ] Run：`python -m pytest runtime/tests/persistence/test_state_store.py -v`。
- [ ] Commit：`feat: add atomic versioned state store`。

## Phase 3：Workflow、Run、Dispatcher 与 Gate

### Task 3.1：Workflow Compiler 与系统最低规则

**Files:**
- Create: `runtime/src/harness_runtime/workflow/compiler.py`
- Create: `runtime/src/harness_runtime/workflow/system_policy.py`
- Create: `runtime/src/harness_runtime/workflow/diagnostics.py`
- Test: `runtime/tests/workflow/test_compiler.py`

- [ ] 定义不可变 `SYSTEM_MINIMUM_RULES`，覆盖代码变更、HIGH、HIGH/DEPLOYMENT 和 verifier 权限。
- [ ] 编译器执行 Node/Role/Gate/Route/Recovery/Artifact 全部引用检查。
- [ ] 项目 hard rules 与系统规则取并集；删除最低节点的草稿必须编译失败。
- [ ] 首发拒绝 DAG、循环、并行和动态表达式。
- [ ] `simulate(intent, risk)` 返回最终线性路径和每个自动加入节点的理由。
- [ ] Run：`python -m pytest runtime/tests/workflow/test_compiler.py -v`。
- [ ] Commit：`feat: compile safe custom workflows`。

### Task 3.2：Run Service

**Files:**
- Create: `runtime/src/harness_runtime/runs/service.py`
- Create: `runtime/src/harness_runtime/runs/identifiers.py`
- Test: `runtime/tests/runs/test_run_service.py`

- [ ] 测试空格、点、路径、盘符、绝对路径和重复 Run 全部在 mkdir 前失败。
- [ ] `create_run` 只接受用户提供的 Intent/Risk，不提供自动分类参数。
- [ ] 调用 Workflow Compiler 获取路线并冻结到 required_nodes。
- [ ] 原子写 state 和 snapshot；工作流修改不得改变已有 Run。
- [ ] 实现 list/switch/pause/resume，但 pause/resume 不跳节点。
- [ ] Run：`python -m pytest runtime/tests/runs/test_run_service.py -v`。
- [ ] Commit：`feat: implement safe run lifecycle`。

### Task 3.3：Dispatcher 与节点确认

**Files:**
- Create: `runtime/src/harness_runtime/workflow/dispatcher.py`
- Create: `runtime/src/harness_runtime/runs/confirmations.py`
- Test: `runtime/tests/workflow/test_dispatcher.py`

- [ ] Dispatcher 只返回 required_nodes 中第一个未完成节点。
- [ ] 未满足人工确认时不得完成 confirmation node。
- [ ] 记录确认人、决定、意见和时间到 phase artifact。
- [ ] CHANGE_REQUEST 迁移活动 Run 时必须展示 route diff 并保留已完成节点一致性。
- [ ] Run 聚焦测试并提交：`feat: add deterministic dispatcher and confirmations`。

### Task 3.4：Gate Engine

**Files:**
- Create: `runtime/src/harness_runtime/gates/engine.py`
- Create: `runtime/src/harness_runtime/gates/evidence.py`
- Create: `runtime/src/harness_runtime/gates/permissions.py`
- Test: `runtime/tests/gates/test_gate_engine.py`

- [ ] 测试缺失、目录、空文件、phase 越界、Evidence 非 JSON/缺九字段均不能 PASS。
- [ ] G3–G8 非 verifier 调用返回 `GATE_PERMISSION_DENIED`。
- [ ] WAIVED 必须提供 scope/reason/owner。
- [ ] FAIL 增加 retry_count 并按映射回退；第三次失败设置 BLOCKED。
- [ ] 自定义 Gate 首发只执行存在/非空检查。
- [ ] Run：`python -m pytest runtime/tests/gates/test_gate_engine.py -v`。
- [ ] Commit：`feat: enforce evidence backed quality gates`。

### Task 3.5：Artifact Service 与文件监听

**Files:**
- Create: `runtime/src/harness_runtime/artifacts/service.py`
- Create: `runtime/src/harness_runtime/artifacts/watcher.py`
- Test: `runtime/tests/artifacts/test_artifact_service.py`

- [ ] 只允许读取项目根和 phase_dir 下已授权文件。
- [ ] 返回内容类型、大小、mtime、SHA-256 和安全状态。
- [ ] 文件变化触发 debounce 后的 `ArtifactChanged`，不自动修改 state。
- [ ] Markdown/JSON 大文件采用大小上限和分页。
- [ ] Commit：`feat: add safe artifact service`。

## Phase 4：Workflow Studio

### Task 4.1：Workflow Draft 与版本服务

**Files:**
- Create: `runtime/src/harness_runtime/workflow/drafts.py`
- Create: `runtime/src/harness_runtime/workflow/versioning.py`
- Test: `runtime/tests/workflow/test_drafts_versions.py`

- [ ] 草稿保存在 SQLite，不污染项目。
- [ ] compile 成功后生成规范化 YAML 和 semantic diff。
- [ ] apply 必须携带 expected workflow hash，获取项目锁后原子替换。
- [ ] 保存版本、作者、时间、摘要和 hash；恢复版本也走 compile/apply。
- [ ] 导入 ZIP 拒绝 Zip Slip、symlink 和超大文件。
- [ ] Commit：`feat: add workflow draft and version service`。

### Task 4.2：Workflow Studio UI

**Files:**
- Create: `apps/renderer/src/features/workflow-studio/**`
- Create: `apps/renderer/src/features/workflow-studio/WorkflowCanvas.tsx`
- Create: `apps/renderer/src/features/workflow-studio/RouteEditor.tsx`
- Create: `apps/renderer/src/features/workflow-studio/DiagnosticsPanel.tsx`
- Test: `apps/renderer/tests/workflow-studio.test.tsx`

- [ ] React Flow 展示 Node Catalog 和有序路线，不允许画并行边。
- [ ] 支持添加、删除、复制、排序、编辑角色/产物/Gate。
- [ ] 系统最低节点显示锁图标且删除操作不可用。
- [ ] Intent/Risk 路由可切换，模拟结果展示自动补充理由。
- [ ] Save 先 compile；错误定位到具体节点/字段；成功后显示 diff 并二次确认。
- [ ] Run：`pnpm --filter @harness/renderer test -- workflow-studio`。
- [ ] Commit：`feat: add visual workflow studio`。

## Phase 5：Codex、审批与实时执行

### Task 5.1：Executor Contract 与 Fake Executor

**Files:**
- Create: `runtime/src/harness_runtime/executors/base.py`
- Create: `runtime/src/harness_runtime/executors/fake.py`
- Test: `runtime/tests/executors/test_executor_contract.py`

- [ ] 定义 probe/start/stream/respond/cancel/recover 接口和统一事件模型。
- [ ] Fake Executor 可脚本化输出、审批、失败、超时和恢复。
- [ ] 先用 Fake 完成 Runtime 与 UI 集成，避免测试依赖真实 Codex。
- [ ] Commit：`feat: define executor adapter contract`。

### Task 5.2：Codex Adapter

**Files:**
- Create: `runtime/src/harness_runtime/executors/codex/adapter.py`
- Create: `runtime/src/harness_runtime/executors/codex/events.py`
- Create: `runtime/src/harness_runtime/executors/codex/process.py`
- Test: `runtime/tests/executors/codex/test_adapter.py`

- [ ] probe 返回路径、版本和能力；缺失时给可操作诊断。
- [ ] start 只传当前节点的角色、规则、上下文和 phase_dir。
- [ ] 解析输出为 ExecutionOutput/ToolCall/ApprovalRequested/Exited。
- [ ] cancel 先优雅终止，再超时 kill；记录退出码。
- [ ] recover 根据持久 session 和 pid/start-time 防 PID 复用。
- [ ] Commit：`feat: integrate codex executor`。

### Task 5.3：Approval Service

**Files:**
- Create: `runtime/src/harness_runtime/approvals/service.py`
- Create: `runtime/src/harness_runtime/approvals/policy.py`
- Create: `apps/renderer/src/features/approvals/**`
- Test: `runtime/tests/approvals/test_policy.py`

- [ ] 分类文件、命令、网络、目录外、部署、删除、权限和危险 Git 请求。
- [ ] 支持 allow-once、deny、受控前缀；禁止通用 shell/python 前缀。
- [ ] 生产部署、删除和强推必须二次确认，决定写审计。
- [ ] Secret/环境变量在 UI 和日志脱敏。
- [ ] Commit：`feat: add scoped execution approvals`。

### Task 5.4：Execution 页面

**Files:**
- Create: `apps/renderer/src/features/execution/**`
- Test: `apps/renderer/tests/execution.test.tsx`

- [ ] 显示当前项目/Run/Node/Role、流式日志、工具调用和审批。
- [ ] 支持过滤、搜索、暂停滚动、复制、导出、取消和恢复。
- [ ] 断线时显示最后 event sequence，重连后按 sequence 补发。
- [ ] Commit：`feat: add realtime execution workspace`。

## Phase 6：恢复、审计、知识与发布

### Task 6.1：Audit Projection 与幂等请求

**Files:**
- Create: `runtime/src/harness_runtime/persistence/audit.py`
- Create: `runtime/src/harness_runtime/api/idempotency.py`
- Create: `apps/renderer/src/features/audit/**`
- Test: `runtime/tests/persistence/test_audit_idempotency.py`

- [ ] 每个 command 以 request_id 去重，重复请求返回原结果。
- [ ] 审计记录状态摘要、节点、Gate、审批、执行器和错误，不保存 secret。
- [ ] 删除 SQLite 后可从项目重新建立项目/Run/Artifact 核心索引。
- [ ] Commit：`feat: add rebuildable audit projection`。

### Task 6.2：Recovery Service

**Files:**
- Create: `runtime/src/harness_runtime/recovery/service.py`
- Create: `runtime/tests/recovery/test_recovery.py`

- [ ] 测试临时文件、state/snapshot 不一致、孤儿进程、丢失会话和 Runtime crash。
- [ ] 启动恢复不自动完成节点或标 Gate PASS。
- [ ] 可恢复会话重连；不可恢复会话记录异常并要求用户决定。
- [ ] Commit：`feat: recover interrupted runtime sessions`。

### Task 6.3：Knowledge Promotion

**Files:**
- Create: `runtime/src/harness_runtime/knowledge/service.py`
- Create: `apps/renderer/src/features/knowledge/**`
- Test: `runtime/tests/knowledge/test_promotion.py`

- [ ] 展示 `19-knowledge-promotion.md` 候选。
- [ ] 支持逐条 review、accept/reject；未经用户确认不写知识库。
- [ ] 首发只做本地 review/accept；Git 同步作为后续 feature flag。
- [ ] Commit：`feat: add reviewed knowledge promotion`。

### Task 6.4：Windows Runtime 与安装包

**Files:**
- Create: `runtime/harness-runtime.spec`
- Create: `apps/desktop/forge.config.ts`
- Create: `scripts/package-runtime.ps1`
- Create: `scripts/package-desktop.ps1`
- Test: `tests/e2e/packaging.spec.ts`

- [ ] PyInstaller 打包 Python 3.11 Runtime 和 schemas/fixtures。
- [ ] Electron 安装包包含 Runtime，首次启动不依赖系统 Python。
- [ ] 测试安装、启动、升级、卸载、AppData 保留和诊断导出。
- [ ] 配置代码签名和更新源；无签名凭证时 CI 只构建 unsigned artifact，不宣称发布通过。
- [ ] Commit：`build: package windows desktop application`。

## Phase 7：端到端验收

### Task 7.1：关键 E2E 场景

**Files:**
- Create: `tests/e2e/project-import.spec.ts`
- Create: `tests/e2e/custom-workflow.spec.ts`
- Create: `tests/e2e/run-execution.spec.ts`
- Create: `tests/e2e/recovery.spec.ts`
- Create: `tests/e2e/security.spec.ts`

- [ ] 导入有效项目并拒绝非法协议。
- [ ] 创建 BUG_FIX/HIGH，验证 Intent/Risk 不被覆盖且 hard rules 全部存在。
- [ ] 自定义线性 Workflow，非法草稿不能保存，合法草稿只影响新 Run。
- [ ] Fake Executor 完成节点、发审批、触发 Gate FAIL、回退两次并第三次 BLOCKED。
- [ ] Codex smoke：存在 Codex 时启动/取消；不存在时显示诊断，不把测试标 PASS。
- [ ] Runtime crash 后恢复项目、Run、事件 sequence 和会话状态。
- [ ] Renderer 无法直接读取文件或执行命令，路径/junction/Zip Slip 攻击被拒绝。
- [ ] Run：

```powershell
pnpm lint
pnpm typecheck
pnpm test
python -m pytest runtime/tests -q
pnpm test:e2e
pnpm build
```

Expected: 全部退出码 0，无未解释 warning；覆盖率达到阈值。

- [ ] Commit：`test: complete desktop acceptance suite`。

### Task 7.2：发布候选与文档

**Files:**
- Create: `docs/user-guide.md`
- Create: `docs/workflow-studio.md`
- Create: `docs/troubleshooting.md`
- Create: `CHANGELOG.md`

- [ ] 文档覆盖导入、Run、Workflow Studio、审批、Gate、恢复、知识和诊断。
- [ ] 从干净 Windows VM 安装 RC，逐条执行架构方案第 20 节验收标准。
- [ ] 将命令、退出码、截图、安装包哈希和已知风险写入 release evidence。
- [ ] 只有全部必需 Gate 通过或有负责人/原因的豁免后创建 tag。
- [ ] Commit：`docs: prepare harness desktop release candidate`。

## 3. 里程碑完成定义

| Milestone | 可交付结果 | 必需验证 |
| --- | --- | --- |
| M1 | 安全 Electron 壳可启动认证 Runtime | contract + security smoke |
| M2 | 可导入项目并安全读写 state/snapshot | protocol + fault injection |
| M3 | 可创建 Run、推进节点、评估 Gate | workflow/run/gate suites |
| M4 | 可视化编辑并编译自定义线性 Workflow | compiler + renderer tests |
| M5 | 可通过 Codex/Fake Executor 执行和审批 | executor + approval integration |
| M6 | 可恢复、审计、知识 review 和打包 | recovery + packaging tests |
| M7 | Windows RC 满足全部首发验收标准 | full CI + Playwright E2E |

## 4. 回滚与兼容策略

- 每个数据库 migration 必须有备份和向前恢复策略；项目 `.harness` 不随 SQLite migration 改变。
- Workflow apply 前保存内容 hash 和旧版本；失败时不触碰活动 Run。
- Runtime 更新失败时 Electron 保留上一版可执行文件并回滚。
- Desktop 不理解的新项目协议进入只读模式，不静默降级解析。
- v2 开发必须独立 feature flag、独立 Schema 和 migration dry-run，不混入 v1 首发路径。

## 5. 计划自检清单

- [ ] 每个架构组件都有实施任务。
- [ ] 自定义编排、系统最低规则和活动 Run 冻结都有测试任务。
- [ ] 项目协议与 SQLite 权威边界明确。
- [ ] 原子写、并发、权限、路径和恢复都有故障测试。
- [ ] Renderer/Electron/Runtime 三层边界都有安全测试。
- [ ] Codex 不可用时有明确失败语义。
- [ ] Windows 打包和干净 VM 验收纳入完成定义。
- [ ] 文档中没有依赖相邻 `harness-main` 源码的实施步骤。
