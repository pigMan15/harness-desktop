# Context Pack

## 任务来源

- RunId: e2e-browser-verification-20260722
- PRD 标识: 无独立 PRD，承接 `doc-diff-feature-completion-20260722` 剩余风险
- PRD 路径或 Wiki 页面: `.harness/phases/doc-diff-feature-completion-20260722/15-evidence.json`
- 原型/截图: 不适用
- 发起人: 用户
- 时间: 2026-07-22

## 需求摘要

上一轮已经补齐 Playwright E2E baseline，并证明 `pnpm test:e2e --list` 可以发现测试；剩余风险是本机缺少 Playwright Chromium 浏览器包，完整浏览器执行失败。本 run 目标是优先修复或绕过该环境问题，使 `pnpm test:e2e` 能完整运行并记录证据。如果受下载、网络或策略限制无法安装浏览器包，需要记录可复现失败、可替代验证和后续处理方式。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| E2E baseline | 当前有 1 个 Playwright 文件、2 个 Chromium 场景 | `tests/e2e/project-import.spec.ts` |
| 剩余风险 | 完整浏览器执行依赖 Playwright Chromium headless shell | 上一 run 证据 |
| 根脚本 | `pnpm test:e2e --list` 已可发现场景 | `package.json` |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| pitfall | `pnpm exec playwright install chromium` 曾两次超时 | `doc-diff-feature-completion-20260722` |
| decision | 当前不应把 E2E 浏览器失败隐藏为通过 | `.harness/rules/evidence.md` |

## 相关代码锚点

- 配置: `playwright.config.ts`
- E2E: `tests/e2e/project-import.spec.ts`
- 包管理: `package.json`, `pnpm-lock.yaml`, `.npmrc`
- HTML 基线: `apps/renderer/index.html`

## 业务不变项

- 不改变 E2E 场景语义，除非发现测试写法本身错误。
- 不引入外部服务依赖。
- 不把浏览器二进制下载失败伪装成通过。

## 待确认问题

- Chromium 下载是否能在当前机器完成；如果不能，是否可使用本机 Chrome/Edge 作为等价执行环境。

## 风险判断

- 建议 Intent: FEATURE
- 建议 Risk: MEDIUM
- 风险理由: 任务涉及测试环境与验证链路，失败会影响发布前信心，但不直接修改生产业务逻辑。

## 知识来源

- Harness run: `.harness/phases/doc-diff-feature-completion-20260722/15-evidence.json`
- 代码文件: `playwright.config.ts`, `tests/e2e/project-import.spec.ts`, `package.json`
