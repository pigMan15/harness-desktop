# 实施计划

## 目标

让 Playwright E2E baseline 从“可发现”推进到“可完整执行”，并记录浏览器执行证据。

## 假设

- 根项目已经包含 `@playwright/test`。
- 本机 Chrome 或 Edge 可作为 Chromium 兼容 fallback。
- 不需要修改 E2E 场景本身。

## 任务列表

1. 复现当前状态
   - 检查文件：`playwright.config.ts`, `tests/e2e/project-import.spec.ts`, `package.json`
   - 命令：`pnpm test:e2e --list`
   - 期望：退出码 0，发现 2 个场景。

2. 尝试官方浏览器安装
   - 命令：`pnpm exec playwright install chromium`
   - 期望：退出码 0；如果超时或失败，记录失败原因。

3. 支持系统浏览器 fallback
   - 编辑文件：`playwright.config.ts`
   - 变更：读取 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`，仅在变量存在时设置 `launchOptions.executablePath`。
   - 验证：未设置变量时 `pnpm test:e2e --list` 仍通过。

4. 完整执行 E2E
   - 命令：设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 为本机 Chrome 路径后运行 `pnpm test:e2e`。
   - 期望：2 个场景通过。

## 验证计划

- `pnpm test:e2e --list`
- `pnpm test:e2e`
- `pnpm typecheck`
- 如配置变更触及 TypeScript 语法，使用相关命令确认无类型错误。

## 回滚计划

- 回滚 `playwright.config.ts` 的环境变量 fallback。
- 若浏览器安装和系统浏览器执行均失败，将 G4 或证据记录为阻塞，不继续扩大改动。

## TDD 记录

- 新增或选中的测试：`tests/e2e/project-import.spec.ts`
- 初始失败：上一 run 中完整浏览器执行缺少 `chromium_headless_shell`
- 实现：优先安装官方 Chromium；失败时加系统浏览器 fallback
- 聚焦结果：待 DEVELOPMENT/UNIT_TEST 阶段记录
- 扩展结果：待 COMPILE/UNIT_TEST 阶段记录
