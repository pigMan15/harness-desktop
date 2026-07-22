# 验收报告

## 范围总结

本 run 已核对 `doc/desktop-architecture.md` 与 `doc/desktop-implementation-plan.md` 中的主要设计/计划条目，并对当前仓库实现、测试、README 和文档入口进行对照。

## 变更总结

- 输出差异清单：`20-doc-implementation-diff.md`。
- 修复英文 README 仍描述 Bridle CLI 的文档错误。
- 新增 `docs/user-guide.md`、`docs/workflow-studio.md`、`docs/troubleshooting.md`。
- 在中文 README 和实施计划中补充当前实现状态与发布级验证边界。
- 修复 TypeScript 静态检查小问题：
  - `App.tsx` 补齐 `diffWorkflow/applyWorkflow` preload API 类型。
  - `ExecutionPage.tsx` 移除未使用 `useCallback`。
  - `index.ts` 移除未使用 `execSync`。
  - `preload/index.ts` 将事件 allowlist 明确命名为 `VALID_EVENT_CHANNELS`。

## 验证总结

- `pnpm typecheck`：PASS。
- `pnpm --filter @harness/desktop test`：PASS，6 个测试通过。
- `pnpm --filter @harness/contracts test`：PASS，6 个测试通过。
- `pnpm test`：未通过，原因是 Vitest 扫描 `runtime/.pytest_cache` 时 EPERM。
- `pnpm --filter @harness/renderer test`：WAIVED，renderer 当前无测试文件。
- `python -m pytest runtime\tests -q`：WAIVED/BLOCKED，当前 shell 无 Python 命令，bundled Python 无 pytest。

## 门禁总结

| Gate | 结果 | 说明 |
| --- | --- | --- |
| G1_REQUIREMENTS | PASS | 范围与验收标准已记录。 |
| G2_DESIGN | PASS | 方案、计划、回滚和风险已记录。 |
| G3_COMPILE | PASS | TypeScript typecheck 通过。 |
| G4_UNIT_TEST | WAIVED | 可用 TS 包测试通过；renderer/Python 测试缺口已记录豁免。 |
| G5_ATDD | NOT_REQUIRED | 当前 FEATURE/MEDIUM 路线不要求。 |
| G6_EVIDENCE | PASS | `15-evidence.json` 合法且字段完整。 |
| G7_PRERELEASE | NOT_REQUIRED | 当前路线不要求部署/预发。 |
| G8_ACCEPTANCE | PASS | 本报告总结范围、变更、验证与剩余风险。 |

## 剩余风险

- Playwright E2E、Windows 干净 VM 安装/升级/卸载、代码签名、自动更新源和真实 Codex smoke 尚未验证。
- README 中 pytest 数量声明未能在当前 shell 环境验证。
- renderer 组件测试、artifact watcher 和 approval service 仍是明确缺口。
- 工作区存在非本任务改动，本 run 未回退也未纳入验收。
