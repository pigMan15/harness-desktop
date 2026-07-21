# Context Pack — Harness Desktop State Machine (Phase 2)

## 任务来源

- RunId: `desktop-state-machine-20260721`
- PRD: 同 M1（`doc/desktop-architecture.md` + `doc/desktop-implementation-plan.md`）
- 前置 Run: `desktop-foundation-20260721`（M1，22/22 DONE）
- 时间: 2026-07-21

## 需求摘要

在 M1 代码基（`runtime/` FastAPI + `packages/contracts` + `apps/` Electron 壳）上实现 Harness Desktop 核心状态机五件套：Protocol Adapter（加载校验 `.harness`）、AtomicStateStore（锁+原子写+revision）、Dispatcher（节点路由）、Gate Engine（确定性检查+权限+重试）、Artifact Service（安全读取+预览）。全部通过 `runtime/` Python Runtime 暴露为 JSON-RPC 端点。

## 相关业务知识（复用 M1 + 增量）

| 知识点 | 摘要 | 来源 |
|---|---|---|
| State 关键约束（§5.1） | run_id 正则、Intent/Risk 枚举、phase_dir 路径安全、required/completed 取交集 | M1 `01-requirement-review.md` |
| 系统最低规则（§5.3） | 代码变更必含 COMPILE/UNIT_TEST/EVIDENCE；HIGH 必含四确认+PRE_MORTEM；G3-G8 verifier 独占 | M1 `00-context-pack.md` |
| Gate 确定性语义（§5.4） | required artifact 存在/非空/路径安全；G6 九字段；WAIVED 元数据 | M1 `03-solution-design.md` ADR-3 |
| 状态事务（§10） | 锁→读 revision→校验→tmp→flush→fsync→os.replace→快照→广播→释放锁 | 架构 §10 |
| 数据归属（§13） | 项目 `.harness/` 权威不可重建；AppData SQLite 可重建 | M1 ADR-3 |

## 相关历史经验

| 类型 | 结论 | 来源 |
|---|---|---|
| case | M1 的 `validate_fixture()` 函数（29 tests）已实现 v1.0 状态校验的 17 条规则雏形，是 Protocol Adapter 的直接前身 | M1 `test_harness_v1_fixtures.py` |
| case | M1 的 `gate_owners` / `has_cycle()` 逻辑是 Gate Engine 循环检测的雏形 | M1 fixture tests |
| decision | Python 3.13 可用（ADR-1），SQLite 用 stdlib `sqlite3`（不引入 ORM） | M1 ADR-1 |
| pitfall | pip 网络超时 + pnpm exotic subdep 拦截持续影响；优先验证已有 Python 依赖 | M1 Task 0.2/1.4 |

## 相关代码锚点

- **M1 代码基（只读参考）**：
  - `runtime/src/harness_runtime/api/app.py` — FastAPI 实例，需扩展 `/health` 外的方法
  - `runtime/src/harness_runtime/contracts/models.py` — Pydantic 基础，需扩展协议模型
  - `runtime/tests/contract/test_harness_v1_fixtures.py` — `validate_fixture()` → Protocol Adapter 雏形
- **待创建**：
  - `runtime/src/harness_runtime/protocol/` — models, loader, validator
  - `runtime/src/harness_runtime/persistence/` — database, atomic_files, project_lock, state_store
  - `runtime/src/harness_runtime/workflow/` — compiler, system_policy, diagnostics, dispatcher
  - `runtime/src/harness_runtime/runs/` — service, identifiers
  - `runtime/src/harness_runtime/gates/` — engine, evidence, permissions
  - `runtime/src/harness_runtime/artifacts/` — service, watcher
  - `runtime/src/harness_runtime/projects/` — service

## 业务不变量

- 所有 M1 不变量继续适用（见 `desktop-foundation-20260721/00-context-pack.md` §业务不变量）
- **新增**：项目写入必须经锁+revision+Schema+原子替换+snapshot 五步；并发冲突返回 `REVISION_CONFLICT` 不 last-write-wins
- **新增**：SQLite 只存派生数据；删除 SQLite 后可从项目 `.harness/` 重建核心索引
- **新增**：G3-G8 非 verifier 调用返回 `GATE_PERMISSION_DENIED`；WAIVED 必须 scope/reason/owner
- **新增**：run_id/Node ID/Gate ID/文件名全部白名单校验；路径 canonicalize 后拒绝 symlink/junction

## 开放问题

- **OQ-1**：SQLite 文件路径是否沿用 M1 约定 `%LOCALAPPDATA%\HarnessDesktop\runtime.db`（架构 §13），还是先放项目根方便调试？→ 建议：开发阶段放项目根 `harness-desktop.db`，Phase 6 打包时迁至 AppData
- **OQ-2**：Protocol Adapter 是否需要支持 YAML 的 `!include` / anchor / alias？→ 建议：首发不支持，只解析纯 YAML/JSON；复杂引用留 v1.1/v2
- **OQ-3**：Dispatcher 的 CHANGE_REQUEST 迁移是否需要 UI 支持（diff 展示），还是先做 Runtime API → 建议：M2 先做 API + 测试，UI 留 Phase 4 Workflow Studio

## 风险判断

- 建议 Intent: FEATURE（已指定）
- 建议 Risk: HIGH（已指定 — 状态机是 Desktop 核心，原子写/revision/并发/权限 bugs 会直接损坏项目 `.harness` 权威状态）
