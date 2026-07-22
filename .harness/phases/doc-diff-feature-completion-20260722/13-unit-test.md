# 单元测试结果

- 命令：`pnpm test`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：renderer 2 个测试文件 6 个测试通过；desktop 1 个测试文件 6 个测试通过；contracts 1 个测试文件 6 个测试通过。
- 后续动作：记录为 G4_UNIT_TEST 通过。

- 命令：`python -m unittest runtime.tests.artifacts.test_watcher runtime.tests.approvals.test_service`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：7 个 Python 测试通过。
- 后续动作：无。

- 命令：`pnpm exec playwright test --list`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：发现 `tests/e2e/project-import.spec.ts` 中 2 个 Chromium 场景。
- 后续动作：确认 E2E baseline 可被 Playwright 识别。

- 命令：`pnpm test:e2e --list`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：通过根脚本发现 `tests/e2e/project-import.spec.ts` 中 2 个 Chromium 场景。
- 后续动作：确认根 e2e 脚本可用于 baseline 发现。

- 命令：`pnpm test:e2e -- --list`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：1
- 结果：FAIL（环境限制）
- 关键输出：额外的 `--` 被 Playwright 当成执行参数，第一个非浏览器场景通过；第二个浏览器场景因缺少 `chromium_headless_shell` 失败，提示需要执行 `pnpm exec playwright install`。
- 后续动作：已尝试安装 Chromium 浏览器包两次，均超时；该完整浏览器执行不作为当前 FEATURE/MEDIUM 路由必需门禁，风险写入证据。

- 命令：`pnpm exec playwright install chromium`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：124
- 结果：BLOCKED（两次超时）
- 关键输出：第一次 184 秒超时，第二次 364 秒超时，未完成 Chromium 二进制安装。
- 后续动作：保留为剩余风险；后续具备可用浏览器包后可重跑完整 e2e。
