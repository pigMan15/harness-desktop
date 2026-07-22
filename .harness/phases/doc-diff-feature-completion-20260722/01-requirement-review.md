# 需求评审

## 目标

根据上一轮差异清单补齐仓库内可实现的功能/测试缺口，让 D13-D16 从缺口状态推进到有源码或测试证据。

## 范围

- 新增 Artifact watcher 能力，并提供 Python 测试。
- 新增 Approval Service，封装审批请求、决策记录、策略判断和审计事件，并提供 Python 测试。
- 新增 renderer Workflow Studio / Execution 相关测试，使 `@harness/renderer test` 不再因无测试文件失败。
- 新增 Playwright E2E baseline 文件，覆盖基础页面/渲染入口或给出可执行的最小烟测。
- 如必要，调整 Vitest/Playwright 配置以避免扫描无关 Python cache。

## 非目标

- 不实现完整发布流水线、签名、自动更新源或 Windows VM 验收。
- 不强制真实 Codex 可用；缺失时仍应提供诊断。
- 不重写现有 Runtime API 架构或 `.harness` 协议。

## 验收标准

- [ ] 标准 1：`runtime/src/harness_runtime/artifacts/watcher.py` 存在，并有测试证明能报告文件创建/修改/删除且不会写 state。
  - 验证方式：运行 artifact 相关 pytest。
- [ ] 标准 2：`runtime/src/harness_runtime/approvals/service.py` 存在，并有测试证明审批分类、二次确认、拒绝和审计记录。
  - 验证方式：运行 approvals 相关 pytest。
- [ ] 标准 3：renderer 包存在测试文件，`pnpm --filter @harness/renderer test` 退出码为 0。
  - 验证方式：运行 renderer Vitest。
- [ ] 标准 4：`tests/e2e/` 存在最小 Playwright 测试，且不宣称覆盖发布级外部验证。
  - 验证方式：检查文件和可行时运行聚焦 E2E。
- [ ] 标准 5：TypeScript typecheck 和相关 Python/TS 测试结果已记录。
  - 验证方式：`12-compile.md`、`13-unit-test.md`、`15-evidence.json`。

## 开放问题

- 当前 shell 的 Python/pytest 环境此前不可用；如果仍不可用，需要使用项目可用解释器或记录 BLOCKED，不能伪造 Python 测试通过。

## 风险备注

- Approval Service 属于权限相关辅助层，必须复用现有 policy，不自行放宽 forbidden command 规则。
