# 知识沉淀

- 当 Playwright bundled Chromium 无法下载时，可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向系统 Chrome/Edge 进行受控 fallback。
- fallback 配置应只在环境变量存在时生效，避免破坏默认 Playwright 行为。
- 证据中必须区分“官方浏览器包通过”和“系统浏览器 fallback 通过”，两者验证价值不同。
- 成功运行 E2E 后，清理 `test-results/.last-run.json`，避免将运行缓存纳入交付。
