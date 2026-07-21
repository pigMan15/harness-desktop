# 方案确认 — Harness Desktop Foundation (M1)

节点：SOLUTION_CONFIRMATION　角色：orchestrator　产物：`04-solution-confirmation.md`
上游：`03-solution-design.md`　门禁：G2_DESIGN（NOT_RUN，待 06-implementation-plan.md 产出后评估）

## 确认人

用户（orchestrator 角色要求人工确认，已满足）。

## 确认内容

用户已审阅并接受 `03-solution-design.md` 中定义的技术方案：

- **ADR-1**：Python `>=3.11`（含 3.13.6），CI 用 3.12，Phase 6 打包时按需降级 → 确认
- **ADR-2**：Electron Forge + Vite + React（非 Tauri）→ 确认
- **ADR-3**：项目协议 `state.json` 为唯一事实源，SQLite 仅可重建派生数据 → 确认
- **仓库结构**：`apps/desktop + apps/renderer + runtime/FastAPI + packages/contracts + schemas + fixtures/harness-v1` → 确认
- **认证握手设计**：一次性 token → 环境变量 → Python 绑定 127.0.0.1:0 → 读 stdout 端口 → GET /health（token + 三版本）→ 确认
- **Preload API**：`window.harness.health()` + `onRuntimeEvent()`，无通用 exec/readFile/writeFile → 确认
- **71 个拟创建文件清单** → 确认
- **验证策略**：本地 `lint→typecheck→test→pytest→build` + CI 配置（等远端推送）→ 确认
- **回滚方案**：三 ADR 各有回滚 + 活动 Run 冻结 + fixture 基线锁定 → 确认

## 进度状态

- G1_REQUIREMENTS = PASS（R1+C1 已通过）
- G2_DESIGN = NOT_RUN（03+06 均完成后评估）
- 下一节点：PRE_MORTEM（quality-guardian）→ 产出 `05-pre-mortem.md`（提前识别 M1 实施中的故障场景）
