# 方案设计 — Harness Desktop Foundation (M1)

节点：SOLUTION_DESIGN　角色：tech-architect　产物：`03-solution-design.md`
上游：`01-requirement-review.md`（范围）、`02-requirement-confirmation.md`（决策）
参考：`doc/desktop-architecture.md`（最终方案）、`doc/desktop-implementation-plan.md`（Phase 0-1）
门禁：G2_DESIGN（本节点产出 G2 的第一个 required artifact，第二个 `06-implementation-plan.md` 在 IMPLEMENTATION_PLAN 节点产出后联合评估）

## 现状上下文

- 仓库 `G:\Project\ai\harness-desktop` 当前仅为裸仓库：`.harness/`（bridle v0.1.0 治理）、`doc/`（架构+实施计划）、`AGENTS.md`/`CLAUDE.md`/`README*`/`LICENSE`。无 `apps/`、`runtime/`、`packages/`、`pnpm-workspace.yaml`。
- 非 git 仓库（`Is a git repository: false`）。
- 本机工具链：Python 3.13.6（`py -3`）、pnpm（假定已装或在 Task 0.1 安装）、Git Bash。
- M1 范围：实施计划 Phase 0（仓库与 CI 基线）+ Phase 1（契约/Runtime/Electron 壳）。

## ADR-1：Python 解释器版本

- **状态**：accepted
- **日期**：2026-07-21
- **决策**：Runtime 依赖设为 `>=3.11`（包含 3.13.6）。`runtime/pyproject.toml` 中 `requires = ">=3.11"`，CI 用 `3.12` 作为锁定版本（Windows runner 默认安装 3.12），本地开发用 3.13。Phase 6 PyInstaller 打包时如遇 3.13 兼容问题，再评估降级到 3.12。
- **影响**：CI 需安装 Python 3.12（非 3.13）；`ruff.toml` target-version 用 `py311`。
- **考虑过的替代方案**：严格 `<3.13`（需额外安装 3.11/3.12 解释器，增加环境搭建复杂度）；`>=3.12`（排除一些低版本用户，但本机只有 3.13）。
- **回滚**：若发现 3.13 在 FastAPI/Uvicorn/路径处理上有行为差异导致 CI 失败，切回 `>=3.11,<3.13` 并在 windows runner 安装 3.12。

## ADR-2：桌面框架选择 Electron（非 Tauri）

- **状态**：accepted
- **日期**：2026-07-21
- **决策**：使用 Electron Forge + Vite + React + TypeScript。实施计划已明确指定，且架构 §18 确认技术栈。
- **影响**：Renderer 通过 typed Preload API（contextBridge）通信；Main 管理 Runtime 生命周期；Node 能力完全封装在 Main 层，Renderer 不可达。
- **考虑过的替代方案**：Tauri（更小、Rust 后端）——但要求团队会 Rust，且与现有 `pnpm workspace + React + Python Runtime` 模式距离较远。Electron 的 Node.js 生态与 Python 子进程管理更成熟。
- **回滚**：M1 仅为骨架，若后续 Phase 发现 Electron 限制不可接受，换 Tauri 代价可控（Renderer 层多数可复用，只需重写 Main 与 Preload 层）。

## ADR-3：项目协议优先于 SQLite

- **状态**：accepted
- **日期**：2026-07-21
- **决策**：`state.json` 是唯一状态事实源；`runs/<id>/state.json` 是快照。SQLite 只保存可从项目重建的派生数据（项目注册列表、Workflow 版本/哈希、执行器会话、审计投影、UI 缓存）。删除 SQLite 后可从项目重建核心索引，不影响 `.harness` 下的任何权威数据。
- **影响**：Runtime 的 Persistence 层设计为两套路径——原子文件写（`state.json`/产物）vs SQLite（投影/索引/缓存）。两者不在同一事务内，一致性由含预期版本的原子替换保证。
- **考虑过的替代方案**：全 SQLite 权威（Sqlite as source of truth）——违反架构 §3.1/§13 的数据归属约定，且使 CLI 与 Desktop 互操作性降级（CLI 直接读写 `state.json`，不走 SQLite）。
- **回滚**：不适用。这是架构级约定，若未来 v2 变更，需新 Schema + migration + 双版本兼容期。

## 推荐方案

### 仓库结构（M1 交付）

```
harness-desktop/
  .gitignore
  .editorconfig
  package.json              # 根 workspace：lint/typecheck/test/test:e2e/build/package 脚本
  pnpm-workspace.yaml       # packages: [apps/*, packages/*]
  tsconfig.base.json        # 公共 TS 配置
  apps/
    desktop/                # @harness/desktop (Electron Forge + Vite)
      src/main/             # RuntimeSupervisor、window 管理、托盘
      src/preload/          # contextBridge 暴露 window.harness.health()
      tests/                # security.test.ts（断言 require/exec/readFile/writeFile 不可用）
    renderer/               # @harness/renderer (React + Vite)
      src/app/              # 根组件、路由
      src/features/projects/# 项目列表 → 后续 Phase
      src/components/       # 共享 UI
      tests/
  runtime/
    pyproject.toml          # requires >=3.11; deps: fastapi, uvicorn, pydantic
    src/harness_runtime/
      main.py               # 入口：读 token、绑定 127.0.0.1:0、启动 uvicorn
      api/
        app.py              # FastAPI 实例、CORS（仅 localhost）、WS 端点
        auth.py             # token 校验中间件、版本握手
      contracts/
        models.py           # Pydantic: RpcRequest/RpcResponse/RpcError/RuntimeEvent/…
    tests/
      api/test_health_auth.py
      contract/test_harness_v1_fixtures.py
      contract/test_rpc_schema.py
      protocol/test_loader_validator.py  # 后续 Phase
  packages/
    contracts/              # @harness/contracts
      src/
        index.ts
        rpc.ts              # TS 类型（同源 JSON Schema）
      tests/
        rpc.test.ts
  schemas/
    state.schema.json       # 从 .harness/state.schema.json 复制冻结
    rpc.schema.json         # RPC 契约的规范 JSON Schema
  fixtures/harness-v1/
    valid-project/.harness/**# 来自本仓库 .harness/ 的冻结副本
    invalid-*/              # 非法 fixture：无效 run_id、phase 越界、重复节点…
```

### 技术选择（M1 范围）

| 层 | 选择 | 理由 |
|---|---|---|
| 包管理 | pnpm workspace | 实施计划指定；Monorepo 共享 tsconfig/contract |
| 桌面壳 | Electron Forge + Vite | 实施计划指定；Forge 封装 build/package/config |
| Renderer | React + Vite | 实施计划指定；后续 Workflow Studio 用 React Flow |
| UI 状态 | Zustand 或 React context | 轻量（M1 仅 health 状态）；Phase 2+ 加 TanStack Query |
| Runtime | Python 3.11+ (3.13), FastAPI/Uvicorn | 实施计划指定；async 原生；loopback JSON-RPC + WebSocket |
| Schema | Pydantic v2 (Python) + 手写 JSON Schema (TS) | 同源校验；不引入 TypeScript 到 Python 的代码生成 |
| Lint/Format | Ruff (Python)、ESLint/Prettier (TS) | 实施计划指定；CI 阶段化执行 |
| CI | GitHub Actions Windows runner | 实施计划指定；OQ-2 决定本地先写配置、有远端后触发 |
| Git | 本地 `git init`，分支 `codex/desktop-foundation` | OQ-2 决策 |

### 关键接口设计（M1 最小集）

**1. Runtime 认证握手（Task 1.3）**
```
Electron Main 生成一次性 token（64-char hex/urandom）
→ 通过环境变量 HARNESS_RUNTIME_TOKEN 传入 Python 子进程
→ Runtime 启动 FastAPI，绑定 127.0.0.1:0，将实际端口写 stdout（Electron 读取）
→ Electron 读取端口后，对 http://127.0.0.1:{port}/health 发送 GET
    Headers: Authorization: Bearer {token}
             X-Harness-Desktop-Version: "0.0.0-dev"
→ Runtime auth 中间件校验 token + 三版本：
    - Desktop version（来自 header）
    - Runtime version（来自自身 pyproject.toml）
    - Project Protocol version（硬编码 "1.0"）
→ 响应 200: { "status": "healthy", "runtime_version":..., "protocol_version":..., "pid":... }
   或 401/403: 非法 token/版本不兼容 → 拒绝连接 → Runtime 退出
```

**2. Preload API（Task 1.4）**
```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('harness', {
  health: () => ipcRenderer.invoke('runtime:health'),
  onRuntimeEvent: (channel: string, callback: Function) => {
    const valid = ['runtime:status', 'runtime:error']
    if (valid.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => callback(...args))
  }
})
// 不暴露: exec, readFile, writeFile, require, process
```

**3. 目录创建任务顺序（Task 0.1 → Task 1.1-1.4）**
```
1. 根文件（package.json, tsconfig.base.json, pnpm-workspace.yaml, .gitignore, .editorconfig）
2. apps/desktop（Forge init → 调为 Vite + contextIsolation + sandbox）
3. apps/renderer（Vite + React → 挂载到 desktop 窗口）
4. runtime/（pyproject.toml → 安装可编辑依赖 → main.py + api/）
5. packages/contracts（TS 类型 + 测试）
6. schemas/（从 .harness/ 冻结复制 + rpc.schema.json 编写）
7. fixtures/harness-v1/（冻结 valid + 构造 invalid）
8. CI 配置（.github/workflows/ci.yml + ruff.toml + vitest.workspace.ts + playwright.config.ts）
```

### 验证策略

- **契约先行**：每个 Task 先写失败测试，再实现。Task 1.1 写参数化 fixture 测试（valid 通过/invalid 返回 error code + JSON Pointer）→ Task 1.2 写 RPC schema 测试（字段缺失/未知 enum/版本不匹配）→ Task 1.3 写 auth 测试（无 token/错 token/不兼容协议）→ Task 1.4 写 security 测试（require/exec/readFile/writeFile 不可用）。
- **本地验证**（OQ-2 无远端，代替 CI）：
  ```powershell
  pnpm lint                    # ESLint + Prettier（TS）+ Ruff（Python）
  pnpm typecheck               # tsc --noEmit（全部 workspace）+ mypy（Python）
  pnpm test                    # Vitest（全部 workspace）
  python -m pytest runtime/tests -q    # Python 全量测试
  pnpm build                   # Vite build renderer + Forge package
  ```
- **CI 配置**（即使无远端也写入，待推送后激活）：Windows runner → install pnpm, Python 3.12 → 顺序执行 format → lint → typecheck → pytest → Vitest → build。

## 受影响文件/模块（M1 需创建的全部文件，按实现顺序）

### Phase 0.1：仓库与工作区
- `G:\Project\ai\harness-desktop\.gitignore`
- `G:\Project\ai\harness-desktop\.editorconfig`
- `G:\Project\ai\harness-desktop\package.json`（根：含 lint/typecheck/test/test:e2e/build/package 脚本）
- `G:\Project\ai\harness-desktop\pnpm-workspace.yaml`
- `G:\Project\ai\harness-desktop\tsconfig.base.json`
- `G:\Project\ai\harness-desktop\runtime\pyproject.toml`
- `G:\Project\ai\harness-desktop\README.md`（已存在，更新）

### Phase 0.2：CI 与质量
- `G:\Project\ai\harness-desktop\.github\workflows\ci.yml`
- `G:\Project\ai\harness-desktop\ruff.toml`
- `G:\Project\ai\harness-desktop\vitest.workspace.ts`
- `G:\Project\ai\harness-desktop\playwright.config.ts`

### Phase 1.1：兼容 fixture
- `G:\Project\ai\harness-desktop\fixtures\harness-v1\valid-project\.harness\**`
- `G:\Project\ai\harness-desktop\fixtures\harness-v1\invalid-*\.harness\**`
- `G:\Project\ai\harness-desktop\schemas\state.schema.json`
- `G:\Project\ai\harness-desktop\schemas\rpc.schema.json`
- `G:\Project\ai\harness-desktop\runtime\tests\contract\test_harness_v1_fixtures.py`

### Phase 1.2：RPC 契约
- `G:\Project\ai\harness-desktop\packages\contracts\package.json`
- `G:\Project\ai\harness-desktop\packages\contracts\tsconfig.json`
- `G:\Project\ai\harness-desktop\packages\contracts\src\index.ts`
- `G:\Project\ai\harness-desktop\packages\contracts\src\rpc.ts`
- `G:\Project\ai\harness-desktop\packages\contracts\tests\rpc.test.ts`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\contracts\__init__.py`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\contracts\models.py`
- `G:\Project\ai\harness-desktop\runtime\tests\contract\test_rpc_schema.py`

### Phase 1.3：Runtime 健康认证
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\__init__.py`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\main.py`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\api\__init__.py`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\api\app.py`
- `G:\Project\ai\harness-desktop\runtime\src\harness_runtime\api\auth.py`
- `G:\Project\ai\harness-desktop\runtime\tests\api\test_health_auth.py`

### Phase 1.4：Electron 壳
- `G:\Project\ai\harness-desktop\apps\desktop\package.json`
- `G:\Project\ai\harness-desktop\apps\desktop\forge.config.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\tsconfig.json`
- `G:\Project\ai\harness-desktop\apps\desktop\vite.main.config.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\vite.preload.config.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\src\main\index.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\src\main\runtime-supervisor.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\src\preload\index.ts`
- `G:\Project\ai\harness-desktop\apps\desktop\tests\security.test.ts`
- `G:\Project\ai\harness-desktop\apps\renderer\package.json`
- `G:\Project\ai\harness-desktop\apps\renderer\tsconfig.json`
- `G:\Project\ai\harness-desktop\apps\renderer\vite.config.ts`
- `G:\Project\ai\harness-desktop\apps\renderer\index.html`
- `G:\Project\ai\harness-desktop\apps\renderer\src\app\App.tsx`
- `G:\Project\ai\harness-desktop\apps\renderer\src\app\main.tsx`

## 数据流

```
用户启动 Desktop
  → Electron Main 创建 BrowserWindow（contextIsolation, no nodeIntegration, sandbox）
  → RuntimeSupervisor.spawn():
      - 生成一次性 token（64-char hex）
      - 设置环境变量 HARNESS_RUNTIME_TOKEN
      - 启动 Python 子进程：python -m harness_runtime.main
      - 从 stdout 读取实际绑定端口
      - GET http://127.0.0.1:{port}/health（Bearer token + version headers）
      - 校验三版本（Desktop/Runtime/Protocol）
  → 握手成功 → 发送 'runtime:status' 事件到 Renderer（IPC via Preload contextBridge）
  → Renderer 接收事件，更新 UI 显示 "Runtime healthy" 状态
  → 握手失败/异常 → 发送 'runtime:error'，Renderer 显示 "Runtime unavailable"

Renderer（React）
  → 用户交互触发 action
  → Preload: window.harness.health() → ipcRenderer.invoke('runtime:health')
  → Main: ipcMain.handle('runtime:health') → fetch Runtime /health
  → 结果回传 Renderer
```

[注：M1 范围仅 health 方法；完整 RPC（project.list/run.create/workflow.compile 等）属后续 Phase，但 contracts 包已定义完整契约接口供 Phase 2+ 实现。]

## 兼容性

- **`.harness` v1.0 严格兼容**：不引入 v2 字段/目录/行为；fixture 测试覆盖 valid + invalid。
- **独立实现，不依赖 `harness_cli` 源码**：Python Runtime 完全独立实现 Protocol Adapter，仅用冻结 fixture 做契约测试（非 import）。
- **无版本降级**：Desktop 不理解的新协议 → 只读模式，不静默降级解析。
- **v2 隔离**：v2 开发必须独立 feature flag/独立 Schema/migration dry-run，不混入 v1 路径。
- **Git 仓库准备**：`.gitignore` 排除 `node_modules/`、`__pycache__/`、`.venv/`、`dist/`、`out/`、`.pnpm-store/`。

## 回滚

- **Python 3.13 → 3.12**：若 CI/测试发现问题，改 `pyproject.toml` 上限为 `<3.13` 并装 3.12（ADR-1 已记录）。
- **Electron → Tauri**：M1 壳代码量小（仅 health 握手 + 安全测试），换框架代价可控（ADR-2）。
- **Fixture 基线**：本仓库 `.harness/` 为 fixture 源（OQ-3）；若上游模板变更，更新冻结 fixture + 记录哈希 diff，不改合同契约。
- **活动 Run 冻结**：本 Run 的 `required_nodes` 已在创建时编译冻结，后续 `workflow.yaml` 修改只影响新 Run。
- **每个数据库 migration**（Phase 2+）需备份 + 向前恢复策略；项目 `.harness` 不随 SQLite migration 改变。

## 被拒绝的替代方案

| 方案 | 拒绝理由 |
|---|---|
| Tauri 替代 Electron | 要求 Rust、IPC 模型不同、与 React Flow 集成成熟度不确定；实施计划已指定 Electron。 |
| 全 SQLite 权威数据 | 违反架构 §3.1/§13；CLI 互操作性降级。 |
| Python 3.11 严格锁定 | 本机仅 3.13，额外安装增加环境复杂度；3.13 对 FastAPI/Pydantic 已稳定。 |
| Deno/Bun 替代 Python Runtime | `.harness` 生态以 Python 为主；实施计划指定 Python 3.11+；已知的 PyInstaller 打包路径（bridle v0.1.0）可复用。 |
| 单 Node（无 Preload 层） | 违反架构 §8.2 三层边界与安全模型 §14；Renderer 无 Node 权限是硬性约束。 |
| M1 做成完整 Phase 1-7 | 无运行软件交付周期长，违反实施计划原则 #2（每个里程碑产出可运行软件）。|

## G2 门禁预评

- required_artifacts: `03-solution-design.md` ✓（本文件）；`06-implementation-plan.md` ✗（待 IMPLEMENTATION_PLAN 节点产出）
- pass_conditions 预判：受影响文件/模块已点名列清单 ✓；回滚方案已记录（ADR 含回滚 + 独立回滚节）✓；验证命令已列出（本地验证命令 + CI 阶段化）✓
- 结论：**G2_DESIGN 暂留 NOT_RUN**，待 IMPLEMENTATION_PLAN 产出 `06-implementation-plan.md` 后联合评估。
