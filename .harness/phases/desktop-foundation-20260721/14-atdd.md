# ATDD — Harness Desktop Foundation (M1)

节点：ATDD　角色：verifier　产物：`14-atdd.md`　门禁：G5_ATDD

## 评估

M1 交付范围（Phase 0 + Phase 1）为仓库骨架 + 契约 + Runtime 握手 + Electron 安全壳。

- **无集成场景**：M1 不涉及端到端用户流程、不涉及 UI 集成测试、不涉及多组件交互验证。
- **无 E2E 测试**：Playwright E2E 属 Phase 7，M1 仅写了 `playwright.config.ts` 骨架。
- **ATDD 覆盖内容**（架构 §5.4）：场景输入和输出已验证、结果为 PASS 或豁免已记录。M1 无此类场景。

## G5_ATDD 门禁评估

| pass_condition | 评估 |
|---|---|
| "场景输入和输出已记录" | N/A（M1 无集成场景） |
| "结果为 PASS，或豁免已记录" | N/A — M1 不涉及 |

- required_artifacts：`14-atdd.md` ✓（本文件，记录无需 ATDD 的理由）
- 结论：**G5_ATDD = NOT_REQUIRED**（M1 无集成/ATDD 场景，符合架构 §5.4 对 NOT_REQUIRED 的定义）
