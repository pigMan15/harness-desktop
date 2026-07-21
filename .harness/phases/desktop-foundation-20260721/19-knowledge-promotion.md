# 知识沉淀 — Harness Desktop Foundation (M1)

节点：KNOWLEDGE_PROMOTION　角色：knowledge-keeper　产物：`19-knowledge-promotion.md`

## 候选知识条目

以下为本 Run 中产生的可沉淀知识，供后续 Run 复用。按 `.harness/knowledge/promotion-policy.md`，所有条目为草稿，需人工 review/accept 后写入长期知识库。

### 1. Windows 环境下 Python 解释器探测策略

- **类型**：case
- **摘要**：Windows 的 app execution alias 会拦截 Git Bash 中的 `python`/`python3` 命令，导致 `new-run.sh` 等脚本失败。解决：优先用 `py -3` 启动器，其次探测全路径（`C:\Python3*\python.exe`、`%LOCALAPPDATA%\Programs\Python\Python3*\python.exe`），最后用户手动配置。
- **来源**：本 Run INTAKE 阶段 + ADR-1
- **适用场景**：任何需要在 Windows 上通过脚本启动 Python 的 harness 流程

### 2. pnpm v11 的 supply-chain 安全策略

- **类型**：pitfall
- **摘要**：pnpm v11 默认启用 `blockExoticSubdeps`，会拦截通过 git URI 解析的依赖（如 `@electron/node-gyp`）。Electron 生态依赖中常见此类子依赖。解决：`.npmrc` 中设 `blockExoticSubdeps=false` 或使用 `pnpm approve-builds` 白名单。
- **来源**：本 Run Task 1.4
- **适用场景**：任何使用 Electron 的 pnpm workspace 项目

### 3. pytest 9.x 退出码 5 语义

- **类型**：pitfall
- **摘要**：pytest 9.1.1 在 0 tests collected 时返回退出码 5（非 0），与旧版 pytest 行为不同。CI 中可能误判为失败。解决：确保至少有一个测试（冒烟测试），或使用 `pytest --no-header` 抑制。M1 用 `test_smoke.py` 的最小通过测试解决。
- **来源**：本 Run Task 0.1
- **适用场景**：新仓库初始化时的 pytest 配置

### 4. harness FEATURE/HIGH 路由的 22 节点全流程

- **类型**：decision
- **摘要**：FEATURE/HIGH 路由包含全部 22 个内置节点。其中 4 个人工确认节点（REQUIREMENT_CONFIRMATION/SOLUTION_CONFIRMATION/ACCEPTANCE_CONFIRMATION/CODING_DESIGN_CONFIRMATION）必须用户明确确认方可完成。M1 首次完整走通该路由，验证了每个节点的产物格式与门禁语义。
- **来源**：本 Run 全部 22 节点
- **适用场景**：后续 FEATURE/HIGH 或类似规模的新功能开发

### 5. M1 交付模板

- **类型**：template
- **摘要**：本 Run 的 21 个阶段产物构成一个完整的"新桌面应用仓库骨架"模板：从 INTAKE→CONTEXT_PACK→REQUIREMENT_REVIEW→SOLUTION_DESIGN→PRE_MORTEM→IMPLEMENTATION_PLAN→CODING_DESIGN→DEVELOPMENT→COMPILE→UNIT_TEST→EVIDENCE→ACCEPTANCE。后续 Phase 2-7 Run 可复用这些产物的章节结构与门禁评估模式。
- **来源**：本 Run `.harness/phases/desktop-foundation-20260721/`
- **适用场景**：后续 Harness Desktop Phase 2-7 开发

## Review 状态

| 条目 | 状态 | Reviewer | 备注 |
|---|---|---|---|
| 1. Python 探测策略 | 草稿 | — | 待人工 review |
| 2. pnpm supply-chain | 草稿 | — | 待人工 review |
| 3. pytest 9.x exit 5 | 草稿 | — | 待人工 review |
| 4. 22-node 全流程 | 草稿 | — | 待人工 review |
| 5. M1 交付模板 | 草稿 | — | 待人工 review |

按 harness 规则，以上条目在用户逐条 review/accept 前不得写入长期知识库。
