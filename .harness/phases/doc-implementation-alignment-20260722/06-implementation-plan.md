# 实施计划

## 目标

完成 `doc` 设计文档与当前实现的差异核对，输出清单，并完善可低风险修复的不一致。

## 假设

- `doc/desktop-architecture.md` 与 `doc/desktop-implementation-plan.md` 是本次核对的设计文档。
- 当前仓库文件和命令输出是实现状态的权威证据。
- Windows VM 安装、真实代码签名、真实 Codex 环境等外部条件不能在本 run 中伪造验证。

## 任务列表

1. 提取设计承诺与验收项。
   - 检查文件：`doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`, `README.md`, `README_en.md`
   - 验证方式：差异清单列出每个主要承诺的来源。
2. 搜索实现证据。
   - 检查文件/模块：`runtime/src/harness_runtime/**`, `runtime/tests/**`, `apps/desktop/**`, `apps/renderer/**`, `packages/contracts/**`, `schemas/**`, `scripts/**`
   - 验证方式：使用 `rg --files` 与精确标识符搜索，记录关键证据。
3. 生成差异清单。
   - 输出文件：`state.phase_dir/20-doc-implementation-diff.md`
   - 验证方式：清单包含 `OK / DOC_STALE / IMPLEMENTATION_GAP / UNVERIFIED` 分类。
4. 完善可修复差异。
   - 首选文件：`doc/desktop-implementation-plan.md`, `README.md`, `README_en.md`
   - 如发现小范围源码缺口，再补源码和对应测试。
   - 验证方式：git diff 与聚焦测试。
5. 记录开发说明和门禁证据。
   - 输出文件：`11-development.md`, `12-compile.md`, `13-unit-test.md`, `15-evidence.json`, `18-acceptance-report.md`

## 验证计划

- 文档清单检查：确认 `20-doc-implementation-diff.md` 非空且覆盖主要模块。
- Python Runtime：优先运行 `python -m pytest runtime/tests -q`。
- TypeScript/桌面：优先运行 `pnpm typecheck` 和 `pnpm test`。
- 若仅文档变更，G3/G4 仍按 workflow 执行等价检查，并在结果中说明没有源码行为变更。

## 回滚计划

- 文档变更可按 git diff 单文件回滚。
- 源码变更若导致编译或测试失败，回退 DEVELOPMENT 重新缩小修复范围。
- 外部不可验证事项保留为 `UNVERIFIED` 和 residual risk，不扩大本 run 目标。

## TDD 记录

- 新增或选中的测试：待 DEVELOPMENT 阶段根据实际变更确定。
- 初始失败：待执行。
- 实现：待执行。
- 聚焦结果：待执行。
- 扩展结果：待执行。
