<p align="center">
  <a href="README.md">中文</a> &nbsp;|&nbsp;
  <a href="README_en.md">English</a>
</p>

# Harness Desktop

AI Coding 流程治理桌面应用。把 `.harness` v1.0 的工程化约束转化为**可观察、可审批、可恢复、可审计**的桌面工作台。

Windows 首发 · 严格兼容 `.harness` v1.0 · 驱动 Codex 等外部 Coding Agent

---

## 架构

```
┌── React Renderer ──────┐
│  Projects · Runs        │
│  Workflow Studio        │
│  Execution · Approvals  │
│  Gates · Artifacts      │
└────────┬────────────────┘
         │ Typed Preload API (contextBridge)
┌── Electron Main ────────┐
│  Window · Runtime Sup.  │
│  Native Dialog · IPC    │
└────────┬────────────────┘
         │ localhost + one-time token
┌── Python Runtime ───────┐
│  Protocol Adapter       │
│  Workflow Compiler      │
│  State Store · Gate Eng.│
│  Dispatcher · Executor  │
└────────┬────────────────┘
         │
   项目 .harness/
```

- **Renderer** 无 Node/Shell 权限，只通过类型化 Preload API 访问业务能力
- **Electron Main** 管理 OS 能力和 Runtime 生命周期，不实现业务逻辑
- **Python Runtime** 是 `.harness` 唯一写入入口，所有状态变更经锁+revision+原子替换+快照

## 快速开始

```powershell
# 安装依赖
pnpm install
python -m pip install -e "runtime[dev]"

# 启动 Runtime（需要 Python 3.11+）
$env:HARNESS_RUNTIME_TOKEN = "dev-token"
python -m harness_runtime.main
# → PORT:12345

# 启动 Desktop
pnpm --filter @harness/desktop dev

# 运行测试
python -m pytest runtime/tests -q    # 176 tests
pnpm test                             # TypeScript tests
```

## 项目结构

```
harness-desktop/
  apps/
    desktop/          Electron Forge + Vite (Main + Preload)
    renderer/         React + Vite (Workflow Studio, Execution, Projects)
  runtime/
    src/harness_runtime/
      api/            FastAPI /health + JSON-RPC endpoints
      contracts/      Pydantic RPC models
      protocol/       .harness v1.0 loader + validator (17 rules)
      persistence/    SQLite + atomic write + project lock + state store + audit
      workflow/       Compiler (SYSTEM_MINIMUM_RULES) + Dispatcher + Drafts + Versioning
      runs/           Run lifecycle service
      gates/          Deterministic gate engine + permissions (G3-G8 verifier-only)
      artifacts/      Safe path reader + SHA-256 + preview
      executors/      Executor adapter contract + Fake + Codex
      approvals/      Policy (8 categories) + classification
      recovery/       Crash recovery + orphan cleanup
      knowledge/      Promotion + review/accept flow
      projects/       Import/list/unregister/validate
    tests/            176 pytest tests
  packages/contracts/ TypeScript type definitions
  schemas/            Frozen state.schema.json + rpc.schema.json
  fixtures/harness-v1/ 1 valid + 8 invalid fixtures (SHA-256 frozen)
```

## 功能

| 模块 | 说明 |
|---|---|
| **Project & Run** | 导入/初始化 `.harness` v1.0 项目，创建/切换/暂停 Run |
| **Workflow Studio** | React Flow 可视化编辑，拖拽节点，编译检查，语义 diff，版本历史 |
| **Workflow Compiler** | 系统最低规则合并，线性路由编译，simulate 预览 |
| **State Store** | 项目锁 → revision 比对 → 原子替换 → 快照 → 并发冲突检测 |
| **Dispatcher** | 节点路由，人工确认门禁，CHANGE_REQUEST 迁移 |
| **Gate Engine** | G1-G8 确定性检查，G3-G8 verifier 独占，WAIVED 元数据，retry→BLOCKED |
| **Codex Adapter** | 子进程 spawn，事件流解析，审批处理，优雅取消/恢复 |
| **Approval Service** | 8 类审批（file/command/network/deploy/delete/permission/git），禁止通用 shell 前缀 |
| **Recovery** | 崩溃恢复，孤儿进程清理，状态一致性验证 |
| **Knowledge** | 候选 draft → review → accept/reject → 长期知识库 |

## 技术栈

| 层 | 技术 |
|---|---|
| Desktop | Electron Forge + TypeScript + Vite |
| Renderer | React + Vite + React Flow + Zustand |
| Runtime | Python 3.11+ / FastAPI / Uvicorn / Pydantic v2 |
| Storage | SQLite (stdlib) + 原子文件写 |
| Contracts | TypeScript types + Python Pydantic (同源 JSON Schema) |
| Testing | pytest (176) + Vitest + Playwright |
| Packaging | PyInstaller + Electron Forge Squirrel.Windows |

## 开发阶段

| Phase | Run | 交付 | Tests |
|---|---|---|---|
| M1 | `desktop-foundation` | Workspace + CI + Fixtures + RPC + Runtime 握手 + Electron 壳 | 35 |
| M2 | `desktop-state-machine` | Protocol + State Store + Compiler + Dispatcher + Gate + Artifact | 119 |
| M3 | `desktop-workflow-studio` | Drafts + Versioning + ZIP IO + React Flow Studio | 138 |
| M4 | `desktop-codex-approval` | Executor Contract + Fake + Codex + Approval Policy | 167 |
| M5 | `desktop-release` | Audit + Idempotency + Recovery + Knowledge + Docs | 176 |

## 与 Bridle CLI 的关系

| | Bridle CLI | Harness Desktop |
|---|---|---|
| 形态 | 终端 TUI | 桌面应用 |
| 引擎 | `harness_cli/` (Python) | 独立 Runtime (Python) |
| 协议 | `.harness` v1.0 | `.harness` v1.0（严格兼容） |
| 执行器 | 内嵌 AI agent | 外部 Codex 子进程 |
| 安全模型 | 单进程 | 三层隔离（Renderer/Preload/Main/Runtime） |

Harness Desktop 不依赖 Bridle CLI 源码，通过冻结 fixture + 契约测试保证协议兼容性。

## 安全

- `contextIsolation=true` / `nodeIntegration=false` / sandbox
- Renderer 无 Node/Shell/文件系统权限
- Runtime 只监听 `127.0.0.1`，一次性 token 认证
- 所有路径 canonicalize 后验证，拒绝 symlink/junction 逃逸
- Secret 存 OS Keychain，日志脱敏
- SQLite 参数化查询，ZIP 导入防 Zip Slip
- CSP 禁止远程脚本

## 文档

- 架构方案：`doc/desktop-architecture.md`
- 实施计划：`doc/desktop-implementation-plan.md`
- 用户指南：`docs/user-guide.md`
- Workflow Studio 指南：`docs/workflow-studio.md`
- 故障排查：`docs/troubleshooting.md`
- 变更日志：`CHANGELOG.md`
- 阶段产物：`.harness/phases/desktop-*/`（5 runs × 22 nodes = 110 artifacts）

## 验证边界

当前仓库包含 Runtime、契约、安全和桌面相关测试，以及 PyInstaller/Electron 打包脚本。干净 Windows VM 安装/升级/卸载、真实代码签名、自动更新源、完整 Playwright E2E 和真实 Codex 环境 smoke 仍需要独立发布级证据，不能仅凭源码存在宣称通过。
