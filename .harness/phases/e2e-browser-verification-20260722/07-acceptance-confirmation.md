# 验收确认

## 确认内容

用户已要求“继续”，本 run 承接上一 run 的 E2E 剩余风险，按已写入的需求评审和实施计划推进。

## 验收口径

- 首选完成态：`pnpm test:e2e` 使用 Playwright bundled Chromium 完整通过。
- 可接受 fallback：如果 bundled Chromium 安装继续受环境阻塞，允许通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 使用系统 Chrome/Edge 完成完整 E2E，并在证据中标明。
- 不可接受：只运行 `--list` 就宣称完整 E2E 通过。

## 未解决问题

- 无需用户额外决策；是否使用 fallback 由实际命令结果决定，并必须写入证据。
