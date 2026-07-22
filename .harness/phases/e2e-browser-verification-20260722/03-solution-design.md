# 方案设计

## 现状上下文

当前 `playwright.config.ts` 使用 `browserName: 'chromium'`，Playwright 默认查找自带 Chromium。上一 run 中 `pnpm test:e2e --list` 已可发现 2 个场景，但完整执行因缺少 `chromium_headless_shell` 失败，且 `pnpm exec playwright install chromium` 两次超时。

本机可发现以下浏览器：

- `C:\Program Files\Google\Chrome\Application\chrome.exe`
- `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`

## 推荐方案

1. 再次尝试官方方式安装 Playwright Chromium：`pnpm exec playwright install chromium`。
2. 如果仍受下载限制，则在 `playwright.config.ts` 中支持 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 环境变量。
3. 使用本机 Chrome 作为 Chromium 兼容执行环境运行 `pnpm test:e2e`。
4. 在证据中明确说明使用的是系统 Chrome fallback，而不是 Playwright bundled Chromium。

## 受影响文件/模块

- `playwright.config.ts`：可选支持 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。
- `.harness/phases/e2e-browser-verification-20260722/*`：记录设计、计划、验证和证据。
- 不修改 E2E 测试场景文件，除非证明测试自身错误。

## 数据流

命令行环境变量 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 传入 Playwright 配置；配置在 Chromium project 的 `use` 中设置 `launchOptions.executablePath`；Playwright 使用指定浏览器启动并执行 `tests/e2e/project-import.spec.ts`。

## 兼容性

- 不设置环境变量时，仍使用 Playwright 默认 bundled Chromium。
- 设置环境变量时，使用本机 Chrome/Edge 完成 Chromium 兼容验证。
- 该配置仅影响 E2E 测试启动方式，不影响应用运行时代码。

## 回滚

- 删除 `playwright.config.ts` 中的环境变量读取和 `launchOptions` 设置即可恢复默认行为。
- 如果系统浏览器执行也失败，保留失败证据并将 G4/G6 记录为失败或阻塞，不继续扩大改动。

## 被拒绝的替代方案

- 直接把 E2E 改成只跑 `--list`：拒绝，不能证明浏览器行为。
- 删除浏览器场景：拒绝，会降低验证价值。
- 在测试中硬编码本机 Chrome 路径：拒绝，跨机器不可移植。

## 失败预演

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| 系统 Chrome 与 bundled Chromium 行为差异 | 浏览器版本不同 | 证据中标明 fallback | E2E 输出和浏览器版本记录 | 去掉环境变量配置 |
| 路径含空格导致启动失败 | Windows 路径解析问题 | 使用环境变量传入完整字符串 | `pnpm test:e2e` 失败输出 | 改用 Edge 或 bundled Chromium |
| 配置破坏默认 Playwright 行为 | launchOptions 总是覆盖 | 未设置环境变量时不写 executablePath | `pnpm test:e2e --list` 和完整测试 | 回滚配置 |
