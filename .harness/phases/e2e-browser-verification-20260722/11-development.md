# 开发记录

## 变更摘要

- 修改 `playwright.config.ts`，新增 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 环境变量支持。
- 未设置环境变量时，Playwright 仍按默认方式使用 bundled Chromium。
- 设置环境变量时，Chromium project 会通过 `launchOptions.executablePath` 使用系统 Chrome/Edge。

## 变更文件

- `playwright.config.ts`

## 中文注释范围

- 未新增中文注释。该变更是短小配置分支，变量名和 Playwright 字段已能表达意图；阶段产物已记录使用约束。

## 开发阶段命令

- `pnpm test:e2e --list`
  - 退出码：0
  - 结果：发现 2 个场景。
- `pnpm exec playwright install chromium`
  - 退出码：124
  - 结果：184 秒超时，官方 Chromium 下载仍未完成。
- 设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` 后运行 `pnpm test:e2e`
  - 退出码：0
  - 结果：2 个 E2E 场景通过。

## TDD 记录

- 新增或选中的测试：`tests/e2e/project-import.spec.ts`
- 初始失败：官方 bundled Chromium 不存在，且安装命令超时。
- 实现：为 Playwright 配置增加系统浏览器 fallback。
- 聚焦结果：`pnpm test:e2e` 使用系统 Chrome fallback 通过。
- 扩展结果：交由 verifier 执行 `pnpm typecheck` 与最终测试记录。
