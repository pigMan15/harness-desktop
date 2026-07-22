# 单元测试与 E2E 结果

- 命令：`pnpm test`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：desktop 1 个文件 6 个测试通过；renderer 2 个文件 6 个测试通过；contracts 1 个文件 6 个测试通过。
- 后续动作：记录为相关单测通过。

- 命令：`pnpm test:e2e --list`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：发现 `tests/e2e/project-import.spec.ts` 中 2 个 Chromium 场景。
- 后续动作：确认根 E2E 脚本可发现场景。

- 命令：`pnpm exec playwright install chromium`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：124
- 结果：BLOCKED
- 关键输出：184 秒超时，Playwright bundled Chromium 未能安装完成。
- 后续动作：按方案使用系统 Chrome fallback。

- 命令：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe pnpm test:e2e`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：2 个 Playwright Chromium 场景均通过，总耗时约 1.1 秒。
- 后续动作：记录 fallback 风险并关闭当前 E2E 完整执行缺口。
