# 实施计划 — Harness Desktop Foundation (M1)

节点：IMPLEMENTATION_PLAN　角色：plan-generator　产物：`06-implementation-plan.md`
上游：`01-requirement-review.md`（范围与验收）、`03-solution-design.md`（技术方案）、`05-pre-mortem.md`（风险预测）
门禁：G2_DESIGN（03+06 齐全 → PASS，本节点联合评估）

## 目标

按 `doc/desktop-implementation-plan.md` 的 Phase 0 + Phase 1 与 `03-solution-design.md` 的技术方案，将 M1（安全 Electron 壳启动认证 Python Runtime）拆分为可验证的小任务。每个任务先写失败测试，再做最小实现，最后跑验证命令。

## 假设

- 本机已安装 pnpm（若无，Task 0.1 前 `npm install -g pnpm`）
- 本机 `py -3` 指向 Python 3.13.6（已确认可用）
- Git 用 Git Bash（`sh.exe`），在 PowerShell 或 Git Bash 终端中执行命令
- 当前无远端 Git 仓库，Task 0.1 执行 `git init` 本地初始化
- M1 范围不涉及 Codex、签名、安装包、Workflow Studio

## 任务列表

### Task 0.1：初始化仓库与 pnpm 工作区

**TDD 先写失败**：在空目录（无 `package.json`/`pnpm-workspace.yaml`）运行 `pnpm install` 应失败（无 workspace）。

**实现 — 创建 7 个文件：**

| 序号 | 文件 | 内容要点 |
|---|---|---|
| 0.1.1 | `.gitignore` | `node_modules/`、`__pycache__/`、`*.pyc`、`.venv/`、`dist/`、`out/`、`.pnpm-store/`、`*.egg-info/` |
| 0.1.2 | `.editorconfig` | `root=true`；`[*]` indent_style=space、indent_size=2、end_of_line=lf、charset=utf-8、trim_trailing_whitespace=true；`[*.md]` trim_trailing_whitespace=false |
| 0.1.3 | `package.json` | 根 `"private": true`；scripts：`lint`（`pnpm -r lint`）、`typecheck`（`pnpm -r typecheck`）、`test`（`vitest run --workspace=vitest.workspace.ts`）、`test:e2e`（空，先定义）、`build`（`pnpm -r build`）、`package`（`pnpm --filter @harness/desktop package`） |
| 0.1.4 | `pnpm-workspace.yaml` | `packages: ['apps/*', 'packages/*']` |
| 0.1.5 | `tsconfig.base.json` | compilerOptions：target=ES2022、module=ESNext、moduleResolution=bundler、strict=true、noUnusedLocals=true、noUnusedParameters=true、skipLibCheck=true；exclude：node_modules |
| 0.1.6 | `runtime/pyproject.toml` | `[project]` name=harness-runtime、version=0.0.0、requires>=3.11；deps：fastapi>=0.100、uvicorn[standard]>=0.20、pydantic>=2.0；`[project.optional-dependencies]` dev：pytest>=7、pytest-cov>=4、ruff>=0.1、mypy>=1.0 |
| 0.1.7 | `README.md` | 已存在，更新为 Harness Desktop 概述（架构摘要 + 快速启动 + 目录结构） |

**Git 初始化：**
```powershell
git init
git checkout -b codex/desktop-foundation
git add .
git commit -m "chore: initialize harness desktop workspace"
```

**验证命令：**
```powershell
pnpm install                    # 退出码 0，无配置错误
python -m pip install -e ".\runtime[dev]"  # 退出码 0
pnpm typecheck                  # 退出码 0（允许初始无 TS 文件，但不能有配置报错）
python -m pytest runtime/tests -q  # 退出码 0（允许 0 tests collected）
```

**期望**：命令全部退出码 0，无配置错误，`codex/desktop-foundation` 分支存在，一个干净工作区等待 Phase 1 代码。

---

### Task 0.2：CI 与质量基线

**TDD 先写失败**：创建一个故意失败的 fixture 测试（`test_must_fail.py`），提交后本地运行应失败。验证 CI 配置包含其执行步骤。

**实现 — 创建 4 个文件：**

| 序号 | 文件 | 内容要点 |
|---|---|---|
| 0.2.1 | `.github/workflows/ci.yml` | name=CI；on=push/pull_request；jobs: ci on windows-latest；steps: checkout→pnpm setup→install Node 20→install Python 3.12→`pip install -e runtime[dev]`→ruff→`pnpm lint`→`pnpm typecheck`→`pytest --cov=runtime/src --cov-report=term`→`pnpm test`→`pnpm build`（每个 step 用 `shell: bash`） |
| 0.2.2 | `ruff.toml` | target-version=py311；select=["E","F","I","N","W","UP"]；ignore=[]；line-length=100 |
| 0.2.3 | `vitest.workspace.ts` | `export default ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts']` |
| 0.2.4 | `playwright.config.ts` | webServer 可选（M1 无 E2E）；projects=[chromium]；空配置骨架，Phase 7 E2E 再填充 |

**TDD 闭环验证**：临时提交故意失败的测试文件（`test_deliberate_fail.py` 中 `def test_fail(): assert False`），本地运行 `python -m pytest runtime/tests -q` 应失败。删除后重跑应通过。

**验证命令：**
```powershell
pnpm lint                       # Ruff + ESLint 退出码 0
pnpm typecheck                  # tsc --noEmit 退出码 0
python -m pytest runtime/tests -q --cov=runtime/src --cov-report=term  # >=85% 总、>=95% 核心
pnpm test                       # Vitest 退出码 0
# 验证 CI 阻断：临时提交失败测试，pytest 应失败
```

---

### Task 1.1：冻结 `.harness` v1.0 兼容 fixture

**TDD 先写失败**：创建 `test_harness_v1_fixtures.py`，参数化读取 fixtures 目录（尚不存在），初始应全部失败（文件不存在）。

**实现：**

| 序号 | 文件/目录 | 内容要点 |
|---|---|---|
| 1.1.1 | `schemas/state.schema.json` | 从 `.harness/state.schema.json` 冻结复制（content hash 记录在测试中） |
| 1.1.2 | `schemas/rpc.schema.json` | 定义 RpcRequest/RpcResponse/RpcError/RuntimeEvent 的 JSON Schema；含 CommandMeta（requestId/projectId/runId?/expectedRevision?） |
| 1.1.3 | `fixtures/harness-v1/valid-project/.harness/` | 从本仓库 `.harness/` 复制 state.json + state.schema.json + workflow.yaml + evals/gates.yaml + agents/*.md + rules/*.md + context/*.md → 简称"valid fixture"；记录内容 SHA-256 |
| 1.1.4 | `fixtures/harness-v1/invalid-run-id/.harness/` | `state.json` 中 run_id = `../escape`（路径越界） |
| 1.1.5 | `fixtures/harness-v1/invalid-phase-escape/.harness/` | `state.json` 中 phase_dir = `../../etc/passwd` |
| 1.1.6 | `fixtures/harness-v1/invalid-intent/.harness/` | `state.json` 中 intent = `HACK`（非法枚举值） |
| 1.1.7 | `fixtures/harness-v1/invalid-duplicate-node/.harness/` | `workflow.yaml` 中 nodes 含重复 id |
| 1.1.8 | `fixtures/harness-v1/invalid-unknown-role/.harness/` | `workflow.yaml` 中 node 的 role 引用不存在的角色文件 |
| 1.1.9 | `fixtures/harness-v1/invalid-unknown-gate/.harness/` | `workflow.yaml` 中 gates 引用未定义的 G99_UNKNOWN |
| 1.1.10 | `fixtures/harness-v1/invalid-endless-rollback/.harness/` | `workflow.yaml` 中 failure_recovery gate_to_node 构成循环 |
| 1.1.11 | `fixtures/harness-v1/invalid-missing-evidence/.harness/` | `state.json` 中 gate G6=PASS 但 15-evidence.json 不存在或不是合法 JSON |
| 1.1.12 | `runtime/tests/contract/__init__.py` | 空文件 |
| 1.1.13 | `runtime/tests/contract/test_harness_v1_fixtures.py` | 参数化 pytest：valid fixture → 通过（协议加载成功）；invalid fixture → 返回稳定 error code + JSON Pointer 指向违规字段 |

**TDD 闭环：** 测试写完先跑（全部红），逐 fixture 加载正确后变绿。

**验证命令：**
```powershell
python -m pytest runtime/tests/contract/test_harness_v1_fixtures.py -v
```
**期望**：valid 通过、8 个 invalid 分类正确、error code 稳定、JSON Pointer 指向精确。

---

### Task 1.2：共享 RPC 契约

**TDD 先写失败**：在 `packages/contracts/tests/rpc.test.ts` 中写参数化测试，对故意损坏的 payload（缺字段/错误 enum/版本不匹配）应失败。`runtime/tests/contract/test_rpc_schema.py` 同类测试，双方暂无实现 → 全红。

**实现：**

| 序号 | 文件 | 内容要点 |
|---|---|---|
| 1.2.1 | `packages/contracts/package.json` | name=@harness/contracts、private=true、main=src/index.ts、types=src/index.ts |
| 1.2.2 | `packages/contracts/tsconfig.json` | extends ../../tsconfig.base.json |
| 1.2.3 | `packages/contracts/src/index.ts` | re-export 全部 rpc 类型 |
| 1.2.4 | `packages/contracts/src/rpc.ts` | `CommandMeta`（requestId:string; projectId:string; runId?:string; expectedRevision?:string）；`RpcRequest`/`RpcResponse`/`RpcError`（code:string; message:string; pointer?:string）；`RuntimeEvent`（type 枚举：StateChanged/WorkflowChanged/ExecutionOutput/ToolCall/ApprovalRequested/GateEvaluated/ArtifactChanged/ExecutorExited/RuntimeWarning）；`ProjectSummary`/`RunStateDto`/`WorkflowDiagnostic` |
| 1.2.5 | `packages/contracts/tests/rpc.test.ts` | 参数化：合法 payload（从 schemas/rpc.schema.json 示例）应通过；字段缺失应失败；未知 enum 应失败；版本不匹配应失败 |
| 1.2.6 | `runtime/src/harness_runtime/contracts/__init__.py` | 空 |
| 1.2.7 | `runtime/src/harness_runtime/contracts/models.py` | Pydantic v2：`CommandMeta`（request_id:str, project_id:str, run_id:Optional[str], expected_revision:Optional[str]）；`RpcRequest`/`RpcResponse`/`RpcError`（含 json_pointer: Optional[str]）；`RuntimeEvent`（type: Literal同上）；`ProjectSummary`/`RunStateDto`/`WorkflowDiagnostic` |
| 1.2.8 | `runtime/tests/contract/test_rpc_schema.py` | 与 TS 测试同源：合法通过；缺字段/未知 enum/版本不匹配失败 |

**TDD 闭环：** 两边测试写完都红 → 实现 Pydantic 模型 + TS 类型 → 两边绿。

**验证命令：**
```powershell
pnpm --filter @harness/contracts test   # Vitest 通过
python -m pytest runtime/tests/contract/test_rpc_schema.py -v  # pytest 通过
```

**期望**：两边用同一 JSON Schema 示例 payload 都通过；非法 payload 都失败。

---

### Task 1.3：Runtime 健康检查与认证握手

**TDD 先写失败**：创建 `runtime/tests/api/test_health_auth.py`，用 httpx AsyncClient 向 `127.0.0.1:0` 发请求。Runtime 尚未实现 → 测试连接失败（红）。

**实现：**

| 序号 | 文件 | 内容要点 |
|---|---|---|
| 1.3.1 | `runtime/src/harness_runtime/__init__.py` | `__version__ = "0.0.0"` |
| 1.3.2 | `runtime/src/harness_runtime/main.py` | 入口：`HARNESS_RUNTIME_TOKEN` 环境变量；若未设置 token → 退出码 1 + stderr 诊断；绑定 `127.0.0.1:0`（uvicorn）；打印端口到 stdout（Electron 读取） |
| 1.3.3 | `runtime/src/harness_runtime/api/__init__.py` | 空 |
| 1.3.4 | `runtime/src/harness_runtime/api/app.py` | FastAPI 实例；CORS 只允许 `127.0.0.1`；依赖注入式 token 校验；`GET /health` 路由（返回 version/protocol_version/pid/python_version）；`GET /health` 中校验 `X-Harness-Desktop-Version` header；版本不兼容 → 402 |
| 1.3.5 | `runtime/src/harness_runtime/api/auth.py` | `verify_token(request: Request)` 依赖：从 `Authorization: Bearer <token>` 取 token，与环境变量 `HARNESS_RUNTIME_TOKEN` 比较；非法返回 401；`check_protocol_version(request)`：比对 Desktop 版本（header）与 Runtime 版本、Protocol="1.0"；不兼容返回 402 |
| 1.3.6 | `runtime/tests/api/__init__.py` | 空 |
| 1.3.7 | `runtime/tests/api/test_health_auth.py` | 用 pytest + httpx AsyncClient + `TestClient(app)` 或用 uvicorn 临时启动：测试 1—无 token → 401；测试 2—错误 token → 401；测试 3—协议 version header 不兼容 → 402；测试 4—正确 token + 正确 version → 200，响应含 runtime_version/protocol_version/pid |

**TDD 闭环：** 4 个测试先全红 → 实现 app/auth → 4 个全绿。

**验证命令：**
```powershell
python -m pytest runtime/tests/api/test_health_auth.py -v
```

**期望**：4 个测试通过，无 token/错 token/不兼容被拒，正确 token 返回 200 含三版本信息。

---

### Task 1.4：Electron Main、Preload 与 Renderer 壳

**TDD 先写失败**：创建 `apps/desktop/tests/security.test.ts`，6 个断言检查 Preload 泄漏。Electron 尚未搭建 → 测试环境不可用（红）。

**实现：**

| 序号 | 文件/目录 | 内容要点 |
|---|---|---|
| 1.4.1 | `apps/desktop/package.json` | name=@harness/desktop；scripts: dev→electron-forge dev、test→vitest、build→electron-forge make；devDeps: @electron-forge/**、electron、vite、vitest |
| 1.4.2 | `apps/desktop/forge.config.ts` | 插件：@electron-forge/plugin-vite；打包：squirrel.windows；publisher 空 |
| 1.4.3 | `apps/desktop/tsconfig.json` | extends ../../tsconfig.base.json；include: src |
| 1.4.4 | `apps/desktop/vite.main.config.ts` | Vite config for main process：build.rollupOptions.external: electron |
| 1.4.5 | `apps/desktop/vite.preload.config.ts` | Vite config for preload |
| 1.4.6 | `apps/desktop/src/main/index.ts` | Electron 入口：创建 BrowserWindow（`contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`、`webPreferences.preload` 指向 preload 脚本）；初始化 RuntimeSupervisor；窗口加载 Renderer |
| 1.4.7 | `apps/desktop/src/main/runtime-supervisor.ts` | `RuntimeSupervisor` 类：`spawn()` 生成 token（`crypto.randomBytes(32).toString('hex')`）→ 环境变量传 Python → `child_process.spawn('py', ['-3', '-m', 'harness_runtime.main'])` → 从 stdout 读端口 → GET /health → 握手成功/失败 → emit runtime:status/runtime:error；含 `restart()` 与 `shutdown()` |
| 1.4.8 | `apps/desktop/src/preload/index.ts` | `contextBridge.exposeInMainWorld('harness', { health: () => ipcRenderer.invoke('runtime:health'), onRuntimeEvent: (channel, cb) => { if(['runtime:status','runtime:error'].includes(channel)) ipcRenderer.on(channel, cb) } })` |
| 1.4.9 | `apps/desktop/tests/security.test.ts` | 6 个断言：`window.require` → undefined；`window.process` → undefined；`typeof window.require !== 'function'`；`exec` 不可用；`readFile` 不可用；`writeFile` 不可用。用 Electron 测试工具或最小集成测试（vitest + jsdom + mock preload） |
| 1.4.10 | `apps/renderer/package.json` | name=@harness/renderer；scripts: dev→vite、build→vite build、test→vitest；deps: react、react-dom；devDeps: @types/react、@types/react-dom、vite、@vitejs/plugin-react |
| 1.4.11 | `apps/renderer/tsconfig.json` | extends ../../tsconfig.base.json；compilerOptions.jsx=react-jsx |
| 1.4.12 | `apps/renderer/vite.config.ts` | @vitejs/plugin-react；base=./（file:// 协议加载） |
| 1.4.13 | `apps/renderer/index.html` | 最小 HTML：`<div id="root">` + `<script type="module" src="/src/app/main.tsx">` |
| 1.4.14 | `apps/renderer/src/app/main.tsx` | `ReactDOM.createRoot(document.getElementById('root')!).render(<App />)` |
| 1.4.15 | `apps/renderer/src/app/App.tsx` | 简单组件：状态 `runtimeStatus: 'loading' | 'healthy' | 'unavailable'`；`useEffect` 挂载 `window.harness.onRuntimeEvent` 监听；根据状态渲染不同提示（"Runtime healthy ✓" / "Runtime unavailable ✗" / "Connecting…"）；包含 `window.harness` 类型声明 |

**TDD 闭环：** security 测试先全红 → 配置 contextIsolation+sandbox+noNodeIntegration → 6 个断言绿。

**验证命令：**
```powershell
pnpm --filter @harness/desktop test          # 安全测试全绿
pnpm --filter @harness/desktop dev            # 启动 Electron 壳
```
**期望**：安全测试全部通过；`pnpm dev` 启动后窗口显示 Renderer 页面（连接中或 healthy/unavailable 状态）。

---

### M1 全量验证

所有 Task 完成后，运行全量验证：

```powershell
pnpm lint                       # Ruff + ESLint 全量
pnpm typecheck                  # tsc --noEmit 全量
python -m pytest runtime/tests -q --cov=runtime/src --cov-report=term  # >=85% 总 / >=95% 核心
pnpm test                       # Vitest 全量（合同 + 安全）
pnpm build                      # Vite build renderer + Electron Forge make
# M1 无需 test:e2e（无 Playwright E2E）、无 package（无 PyInstaller）
```

## 验证计划

| 阶段 | 验证命令 | 通过标准 |
|---|---|---|
| Task 0.1 完成 | `pnpm install && python -m pip install -e runtime[dev] && pnpm typecheck && python -m pytest runtime/tests -q` | 全部退出码 0；无配置错误 |
| Task 0.2 完成 | `pnpm lint && pnpm typecheck && python -m pytest runtime/tests -q --cov=runtime/src --cov-report=term && pnpm test` | 退出码 0；覆盖率达标 |
| Task 1.1 完成 | `python -m pytest runtime/tests/contract/test_harness_v1_fixtures.py -v` | valid 通过、8 invalid 分类正确 |
| Task 1.2 完成 | `pnpm --filter @harness/contracts test && python -m pytest runtime/tests/contract/test_rpc_schema.py -v` | 双边契约测试全绿 |
| Task 1.3 完成 | `python -m pytest runtime/tests/api/test_health_auth.py -v` | 4 个测试：401/401/402/200 |
| Task 1.4 完成 | `pnpm --filter @harness/desktop test` | 6 个安全断言全绿 |
| M1 全量 | 上述全量命令 | 全部退出码 0；无未解释 warning；覆盖率达标 |

## 回滚计划

- **Python 版本问题**：降 `runtime/pyproject.toml` requires 为 `<3.13` + 安装 Python 3.12（详见 ADR-1）
- **Electron 壳**：reset Forge config 到最小空白初始化再逐步加功能
- **Fixture 基线**：回退到冻结哈希版本，不改合同
- **Workspace**：`git stash` + `rm -rf node_modules .venv` + 重新 `pnpm install`
- **活动 Run**：本 Run 的 `required_nodes` 已冻结，`workflow.yaml` 修改不影响本 Run
- **Task 粒度失败**：单个 Task 的 TDD 红→绿→全量 三阶段；Task 失败不回退已完成 Task
- **停止条件**（来自 PRE_MORTEM §停止条件）：`pnpm install` 3 连败 / Python 无法启动 / typecheck 或 pytest 持续失败 / 安全壳破裂 / CSP 过松 / CI 环境连续 2 次失败 / fixture 未覆盖 Windows 路径 Case → 任一触发则停止推进

---

## G2_DESIGN 门禁评估

本节点产出 `06-implementation-plan.md`，与 `03-solution-design.md` 联合构成 G2 全部 required artifacts。

- **required_artifacts**：`03-solution-design.md` ✓（9025B，在 phase_dir 内）+ `06-implementation-plan.md` ✓（本文件）
- **pass_conditions**：
  - "已点名受影响文件或模块" ✓ — 03 §受影响文件/模块 点名了 71 个文件清单，06 逐任务点名具体文件路径
  - "中高风险任务已记录回滚方案" ✓ — 03 含 3 ADR 各回滚 + 独立回滚节；05 含 12 个故障模式各回滚列；06 §回滚计划 含 6 项回滚 + 停止条件列表
  - "计划包含验证命令或检查方式" ✓ — 06 每个 Task 含验证命令与期望，§验证计划 含阶段化验证表，M1 全量命令
- **确定性检查**：06-implementation-plan.md 文件存在、非空、路径在 phase_dir 内 ✓
- **结论**：**G2_DESIGN = PASS**
