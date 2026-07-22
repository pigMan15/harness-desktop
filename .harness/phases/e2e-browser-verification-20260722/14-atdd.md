# ATDD 结果

- 节点要求：NOT_REQUIRED
- 原因：当前 run 为 `FEATURE / MEDIUM`，workflow 路由不包含 `ATDD` 节点。
- 补充场景验证：设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` 后运行 `pnpm test:e2e`，2 个场景通过。
- 说明：该验证使用系统 Chrome fallback，不是 Playwright bundled Chromium。
