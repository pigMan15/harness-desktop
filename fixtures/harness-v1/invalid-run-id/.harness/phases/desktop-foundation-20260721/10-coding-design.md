# 编码设计确认 — Harness Desktop Foundation (M1)

节点：CODING_DESIGN_CONFIRMATION　角色：developer　产物：`10-coding-design.md`
上游：`06-implementation-plan.md`（实施计划）、`03-solution-design.md`（技术方案）
触发条件：FEATURE/HIGH → 必须生成编码设计并等待确认
参考：`.harness/rules/coding-design.md`、`.harness/rules/code-comment.md`

## 推荐方案

按 `06-implementation-plan.md` 的 6 个 Task 顺序推进，每个 Task 走 TDD 循环。实现顺序为依赖驱动：

```
Task 0.1 (workspace 骨架)
  → Task 0.2 (CI + 质量工具配置)
    → Task 1.1 (fixtures + schemas)  ──┐
    → Task 1.2 (RPC contracts TS+Py) ──┤ 可并行，但 contracts 不依赖 fixtures
    → Task 1.3 (Runtime health/auth) ──┤ 依赖 contracts (Pydantic models)
    → Task 1.4 (Electron shell)      ──┘ 依赖 contracts (TS types) + Runtime (health endpoint)
```

每个 Task 的实现模式：
1. **创建文件骨架**（空文件或最小配置，确保路径存在）
2. **写测试**（TDD 红，确认测试因正确原因失败）
3. **最小实现**（TDD 绿，只写让测试通过的代码）
4. **全量验证**（Task 内全部测试 + 跨 Task 回归）

## 架构风格

- **Monorepo 分层**：`apps/`（桌面壳+渲染）、`runtime/`（业务逻辑）、`packages/`（共享契约）、`schemas/`（冻结协议）、`fixtures/`（测试夹具）——物理隔离，依赖单向（apps → packages ← runtime contracts）
- **协议优先**：先写 contract（TS 类型 + Python Pydantic + 同源 JSON Schema），两边测试都验同一份 payload，防止漂移
- **安全壳分层**：Renderer（纯 React，无 Node 权限）→ Preload（contextBridge，类型化 API）→ Main（Node 能力，管理 Runtime 进程）——权限逐层收紧
- **最小接口**：M1 仅暴露 `window.harness.health()` 与事件订阅，为后续 Phase 预留扩展位

## 设计模式选择

| 模式 | 场景 | 理由 |
|---|---|---|
| **依赖注入** | Runtime auth 中间件 | FastAPI `Depends(verify_token)` + `Depends(check_protocol_version)` 组合注入；测试时可替换 token 验证逻辑 |
| **观察者** | RuntimeSupervisor → Renderer 事件 | Main 层 `EventEmitter`，Preload 通过 `ipcRenderer.on` 转发；Renderer 用 React `useEffect` 订阅 |
| **适配器** | RPC 契约层 | TS 类型与 Python Pydantic 都实现同一 JSON Schema 约定的接口形状；不引入代码生成，手工维护但受双边测试约束 |
| **策略** | Python 子进程探测 | `RuntimeSupervisor.spawn()` 按顺序尝试 `py -3` → 全路径 → 用户配置；探测顺序即为策略 |

不引入：DI 容器（FastAPI Depends 已够）、状态管理库（M1 只用 React useState/useEffect，Phase 2+ 按需加 Zustand/TanStack Query）。

## 模块边界

### `apps/desktop/src/main/`
- **职责**：Electron 生命周期、BrowserWindow 创建（安全参数）、RuntimeSupervisor、IPC handlers
- **不负责**：任何业务逻辑、Workflow/Run/Gate 计算、直接文件读写（仅通过 Runtime command）
- **对外**：面向 Renderer 通过 `ipcMain.handle` / `webContents.send`；面向 Runtime 通过 localhost HTTP

### `apps/desktop/src/preload/`
- **职责**：白名单化的 `contextBridge.exposeInMainWorld`；IPC 消息类型校验
- **不负责**：直接访问 Node API、处理业务数据、暴露任何通用能力
- **对外**：只暴露 `window.harness` 的两个方法 + 两个事件频道

### `apps/renderer/src/`
- **职责**：React 组件、UI 状态（runtimeStatus）、用户交互
- **不负责**：文件系统、子进程、网络请求（仅通过 `window.harness`）、Token 存储
- **对外**：仅通过 `window.harness` 与 Preload 通信

### `runtime/src/harness_runtime/`
- **职责**：FastAPI app、auth 中间件、协议校验、健康检查端点
- **不负责**：UI、进程管理（由 Main 管理 Runtime 进程本身）、直接写项目文件（M1 不做）
- **对外**：localhost HTTP（仅 127.0.0.1），token 认证

### `packages/contracts/`
- **职责**：TypeScript 类型定义（`RpcRequest`/`RpcResponse`/`RuntimeEvent`/…）
- **不负责**：运行时逻辑、API 调用、数据转换
- **对外**：被 apps/ 与 runtime/ contracts 各自消费（通过 import；Runtime 侧不依赖 TS 包，而是独立 Pydantic 实现）

## 前后端协作点

### 协作点 1：Runtime 启动与握手
```
Electron Main (runtime-supervisor.ts)
  spawn: py -3 -m harness_runtime.main
    ← stdout: "PORT:54321"  (Runtime 启动后打印实际绑定端口)
  GET http://127.0.0.1:54321/health
    Headers: Authorization: Bearer <token>, X-Harness-Desktop-Version: 0.0.0
    → 200 { runtime_version, protocol_version, pid, status: "healthy" }
    → 401 (bad token) / 402 (version mismatch)
  emit 'runtime:status' → ipcRenderer → window.harness.onRuntimeEvent → React state
```

### 协作点 2：Renderer 查询 Runtime 状态
```
React Component (App.tsx)
  window.harness.health()
    → ipcRenderer.invoke('runtime:health')
      → ipcMain.handle('runtime:health') → GET /health
    ← { healthy: boolean, runtimeVersion, protocolVersion }
```

### 契约共享
```
schemas/rpc.schema.json (规范源)
  ├── packages/contracts/src/rpc.ts (TS 手工实现，类型断言/校验函数)
  └── runtime/.../contracts/models.py (Pydantic 手工实现，model_validate)
  两边测试覆盖同一组示例 payload（从 schemas/rpc.schema.json 的 examples 字段读取）
```

## 复用现有代码

M1 为全新仓库，无现有源码可复用。但可借鉴：

- **本仓库 `.harness/`**：作为 fixture 基线源（valid fixture 直接复制；invalid fixture 参照其结构构造非法变体）
- **`bridle` v0.1.0 的 `pyproject.toml`**：作为 Python 打包参考（依赖声明、entry_points、ruff/pytest 配置）
- **`.harness/state.schema.json`**：直接冻结复制为 `schemas/state.schema.json`

## 不采用的方案

| 方案 | 原因 |
|---|---|
| 全量代码一次写完再测试 | 违反 TDD 循环（实施计划要求每个 Task "先写失败测试再实现"）；71 个文件一次性提交风险高，问题定位困难 |
| 跳过 Phase 0 直接写 Phase 1 | 无 workspace 骨架 → pnpm 无法运行 → TypeScript/Python 测试无法执行；Phase 0 是后续一切的前提 |
| 合并 Task 1.1+1.2（fixture+contract 一次搞） | fixture 验证协议完整性，contract 验证类型一致性——两者测试正交；混合实现可能掩盖 fixture 路径问题或 contract 字段缺失 |
| 用代码生成工具（openapi-generator 等）从 JSON Schema 自动生成 TS+Python | 增加工具链复杂度（M1 不应引入新依赖）；手工维护 + 双边测试在 2 套类型（TS+Py）规模下成本可控；代码生成在 Phase 2+ 扩展类型时再评估 |
| 跳过 Preload 层直接 IPC | 违反安全模型 §14；Renderer 不应持有任何 IPC 通道（Preload 是唯一白名单化通道） |
| 在 Renderer 中启动/管理 Runtime 进程 | 违反安全模型：Renderer 无 Node 权限（不能 spawn），Runtime 管理必须是 Main 层特权 |

## 中文注释策略

按 `.harness/rules/code-comment.md` 要求：

- **Python**：模块级 docstring 用中文说明职责与边界；类与方法用中文注释说明意图（非逐行翻译）；关键校验逻辑加中文注释说明约束来源（如 `# 架构 §5.1：run_id 必须匹配 ^[...]$`）
- **TypeScript**：模块级 JSDoc 用中文；类型定义用中文注释说明字段语义；Preload 安全敏感代码加中文注释说明安全约束来源
- **不需注释的情况**：标准库调用、显而易见的赋值、React JSX 渲染（除非有非直观逻辑）

## 风险与回退

- **实施顺序风险**：若 Task 0.1 的 `pnpm install` 失败（网络/版本），阻塞全部后续 → 回退：检查 pnpm 版本、切换镜像源、fallback npm
- **Python 3.13 风险**：某库在 3.13 上行为与 CI 的 3.12 不一致 → 回退：降级限制 `<3.13`，装 3.12（ADR-1 预设）
- **Electron Forge+Vite 兼容风险**：配置冲突导致 dev/build 失败 → 回退：Reset 到最小 Forge 配置，逐步加 Vite、sandbox、CSP
- **安全壳破裂风险**：安全测试未覆盖到的 Preload 泄漏路径 → 停止条件：`window.require`/exec/readFile/writeFile 任一未被阻止
- **TDD 循环卡死风险**：测试写不出来或写不对 → 记录为公开问题，降级为脚本化复现验证（不假称通过了单测）

## 需要用户确认

1. **实施顺序**：Task 0.1 → 0.2 → 1.1 → 1.2 → 1.3 → 1.4，按依赖链推进。每完成一个 Task commit 一次，不攒大量未提交代码。是否同意？
2. **TDD 粒度**：每个 Task 先写测试（红），确认失败原因正确，再写最小实现（绿），最后跑全量验证。不在一个 Task 内把所有文件写全才跑测试。是否同意？
3. **commit 策略**：每个 Task 完成即 commit（如 `feat: initialize pnpm workspace and repo skeleton`），共 6+ commits。是否同意？
4. **暂时跳过 `pnpm build`**：Task 0.1 创建 `package.json` 后，`pnpm build` 脚本指向还不存在的子包（apps/*），此时 build 会失败。是否同意在 Task 0.1 阶段只验证 `pnpm install`/`typecheck`/`pytest`，build 命令在 Task 1.4 完成（子包齐全）后再验证？
