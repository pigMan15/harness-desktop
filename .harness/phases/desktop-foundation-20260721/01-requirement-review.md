# 需求评审 — Harness Desktop Foundation (M1)

节点：REQUIREMENT_REVIEW　角色：requirement-analyst　产物：`01-requirement-review.md`
上游：`00-intake.md`、`00-context-pack.md`　门禁：G1_REQUIREMENTS

## 目标

构建 **Harness Desktop** 首发基础，交付实施计划里程碑 **M1**：一个 Windows 首发、严格兼容 `.harness` v1.0、安全的 Electron 桌面壳，可启动并完成与本地 Python Runtime 的认证握手。本 Run = 实施计划 Phase 0（仓库与开发基线）+ Phase 1（契约、Runtime 与桌面骨架）。Runtime 是 `.harness` 项目状态的唯一写入入口；Renderer 只通过类型化 Preload API 访问业务能力，无 Node/Shell 权限。

## 范围

**M1 交付物（可验证清单）**

1. 仓库与 workspace 骨架（Phase 0 Task 0.1）
   - `.gitignore`、`.editorconfig`、根 `package.json`、`pnpm-workspace.yaml`（packages: apps/*, packages/*）、`tsconfig.base.json`、`runtime/pyproject.toml`、`README.md`
   - Git 初始化 + 分支 `codex/desktop-foundation`
   - 根 `package.json` 统一脚本：`lint`、`typecheck`、`test`、`test:e2e`、`build`、`package`

2. CI 与质量基线（Phase 0 Task 0.2）
   - `.github/workflows/ci.yml`（Windows runner；装 Node/pnpm/Python）
   - 顺序执行：格式→lint→typecheck→pytest→Vitest→build
   - `ruff.toml`、`vitest.workspace.ts`、`playwright.config.ts`
   - Runtime 覆盖率阈值 85%，核心 protocol/workflow/state/gate 95%

3. `.harness` v1.0 兼容 fixture（Phase 1 Task 1.1）
   - `fixtures/harness-v1/valid-project/.harness/**` + 多个 `invalid-*`
   - `schemas/state.schema.json`、`schemas/rpc.schema.json`
   - 参数化契约测试：有效通过、无效返回稳定 error code + JSON Pointer

4. 共享 RPC 契约（Phase 1 Task 1.2）
   - `packages/contracts/src/{index.ts,rpc.ts}`（TS）+ `runtime/src/harness_runtime/contracts/models.py`（Pydantic）
   - `RpcRequest`/`RpcResponse`/`RpcError`/`RuntimeEvent`/`ProjectSummary`/`RunStateDto`/`WorkflowDiagnostic`
   - `CommandMeta` 含 `requestId`/`projectId`/`runId?`/`expectedRevision?`
   - TS 与 Python 同源 JSON Schema 验证示例 payload

5. Runtime 健康检查与认证握手（Phase 1 Task 1.3）
   - `runtime/src/harness_runtime/main.py`、`api/app.py`、`api/auth.py`
   - 绑定 `127.0.0.1:0`，一次性 token 经环境变量传入
   - `runtime.health` 返回 Desktop/Runtime/Project Protocol 三版本 + 进程信息
   - 无 token / 错误 token / 协议不兼容 → 拒绝

6. Electron Main/Preload/Renderer 壳（Phase 1 Task 1.4）
   - `apps/desktop`（Forge+Vite，`contextIsolation=true`、sandbox、`nodeIntegration=false`）
   - `apps/desktop/src/main/runtime-supervisor.ts`：启动 Python、读握手端口、校验 token、异常退出发事件
   - `apps/desktop/src/preload/index.ts`：只暴露 `window.harness.health()` + 事件订阅
   - Renderer：显示 Runtime healthy/unavailable
   - 安全测试：`window.require`、通用 `exec`/`readFile`/`writeFile` 均不可用

## 非目标（本 Run 不做，留待后续 Run）

- AtomicStateStore、Dispatcher、GateEngine、ArtifactService、Workflow Compiler、Run Service（Phase 2–3）
- Workflow Studio、Node Catalog、自定义编排编译器与版本服务（Phase 3–4）
- Codex Adapter、Approval Service、Execution 页面（Phase 5）
- Audit Projection、Recovery Service、Knowledge Promotion、Windows 安装包/签名/自动更新（Phase 6）
- 端到端 Playwright 验收与发布候选（Phase 7）

## 验收标准

按 `.harness/context/acceptance.md`：标准必须可观察。

- [x] **标准 1（仓库基线）**：给定干净 checkout，当执行 `pnpm install` 与 `python -m pip install -e runtime[dev]`，应无配置错误；`pnpm typecheck` 与 `python -m pytest runtime/tests -q` 退出码为 0（允许初始测试数为 0）。
  - 验证方式：在仓库根依次运行上述命令，检查退出码与 stderr 无配置错误。
- [x] **标准 2（CI 阻断）**：给定一个故意失败的 fixture 测试，当 CI 运行，应失败阻断；恢复后重跑应通过。
  - 验证方式：提交失败 fixture → CI 红；恢复 → CI 绿。
- [x] **标准 3（fixture 分类）**：给定 `fixtures/harness-v1/` 下有效与无效 fixture，当运行 `python -m pytest runtime/tests/contract/test_harness_v1_fixtures.py -v`，有效 fixture 应全部通过，无效 fixture 应返回稳定 error code 与 JSON Pointer 指向违规字段。
  - 验证方式：pytest 输出分类正确，无效用例的断言含 error code 与 pointer。
- [x] **标准 4（RPC 契约同源）**：给定同一 JSON Schema 示例 payload，当 TS 与 Python 各自校验，合法 payload 应通过；字段缺失、未知 enum、版本不匹配应失败。
  - 验证方式：`pnpm --filter @harness/contracts test` 与 `python -m pytest runtime/tests/contract/test_rpc_schema.py -v` 均含上述通过/失败用例。
- [x] **标准 5（认证握手）**：给定 Runtime 已启动，当分别用 无 token / 错误 token / 不兼容协议版本 请求 `runtime.health`，应被拒绝（非 200）；当用正确 token 请求，应返回含三版本与进程信息的 200。
  - 验证方式：`python -m pytest runtime/tests/api/test_health_auth.py -v` 覆盖三种拒绝与一种成功。
- [x] **标准 6（安全壳）**：给定 Electron 壳启动，当在 Renderer 上下文探测 `window.require`、通用 `exec`/`readFile`/`writeFile`，应均不可用（undefined/抛错）；`RuntimeSupervisor` 应启动 Python 并完成 token 校验；Renderer 应据握手结果显示 healthy/unavailable。
  - 验证方式：`pnpm --filter @harness/desktop test` 的 security 测试断言上述不可用；`pnpm --filter @harness/desktop dev` 启动后页面状态正确。

## 开放问题

（G1 允许"已记录"；下列需在 REQUIREMENT_CONFIRMATION 或 SOLUTION_DESIGN 定夺，记录于此备查。）

- **OQ-1 Python 解释器版本**：计划要求 `>=3.11,<3.13`，本机仅 3.13.6。选项 (a) 放宽上限到 3.13 + 同步 pyproject/CI；(b) 安装 3.11/3.12。**阻塞 DEVELOPMENT，须 SOLUTION_DESIGN 前定。**
- **OQ-2 Git 远端**：环境非 git 仓库。需确认是否新建 git 仓库 + 分支 `codex/desktop-foundation`，以及是否存在 GitHub 远端供 CI（Task 0.2）触发。无远端则 Task 0.2 的 CI 部分降级为本地 lint/typecheck/test 校验。
- **OQ-3 Fixture provenance**：架构 §17 要求从已发布模板复制 + CI 哈希审计。M1 是否以本仓库 `.harness/` 为初始 fixture 基线并记录其内容哈希？须 Task 1.1 前明确。
- **OQ-4 Codex 依赖**：确认 M1 不依赖真实 Codex（属 Phase 4），Runtime 握手与 Executor 接口为后续预留即可。
- **OQ-5 签名**：确认 M1 不涉及代码签名/安装包（属 Phase 6）；CI 无凭证时只产 unsigned artifact。

## 风险备注

- **风险等级 HIGH 的理由**：跨 Electron/React/Python 三栈从零搭建；处理 `.harness` 权威状态、OS Keychain、子进程与路径安全（架构 §14 列大量安全约束）；须协议兼容防漂移。故 HIGH 的额外确认节点（REQUIREMENT_CONFIRMATION/SOLUTION_CONFIRMATION/PRE_MORTEM/ACCEPTANCE_CONFIRMATION）与预发布/接口测试为合理保险。
- **下一人工门禁**：REQUIREMENT_CONFIRMATION（orchestrator）需用户明确确认接受本需求评审（范围与验收标准）方可完成；未确认前不得推进。
- **intent/risk 一致性**：已由用户在 `bridle new` 指定 FEATURE/HIGH，本评审一致，不覆盖。

## G1 门禁自评

- required_artifacts `01-requirement-review.md`：已写入 `state.phase_dir`，普通文件、非空、路径在 phase_dir 内 ✓
- pass_conditions：目标已说明 ✓；验收标准可观察（给定/当/应 + 命令退出码形式）✓；开放问题已记录 ✓
- 结论：**G1_REQUIREMENTS = PASS**
