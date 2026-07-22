# 需求评审

## 目标

补齐 Playwright 浏览器执行环境并运行完整 E2E 验证，使上一 run 中“只可发现、未完整执行”的 E2E baseline 风险得到关闭或形成明确阻塞证据。

## 范围

- 检查 Playwright 配置、测试文件和根脚本。
- 尝试安装或定位可用 Chromium/Chrome/Edge 浏览器执行环境。
- 执行 `pnpm test:e2e` 或等价 Playwright 命令。
- 记录命令、退出码、关键输出和剩余风险。

## 非目标

- 不扩展新的 E2E 业务场景。
- 不做 Windows 安装包、签名、升级、卸载验证。
- 不调整与 E2E 执行无关的产品 UI 或 runtime 功能。

## 验收标准

- [ ] 标准 1：`pnpm test:e2e --list` 退出码为 0，输出包含 2 个 Playwright 场景。
  - 验证方式：运行命令并记录输出。
- [ ] 标准 2：`pnpm test:e2e` 退出码为 0，2 个 Chromium 场景通过；或记录浏览器环境阻塞并给出可复现命令。
  - 验证方式：运行完整 E2E 命令并记录退出码。
- [ ] 标准 3：如果需要使用本机 Chrome/Edge 作为执行环境，配置变更必须限定在 Playwright 测试配置或环境变量，并记录原因。
  - 验证方式：检查变更文件和命令输出。

## 开放问题

- 当前网络是否能完成 `pnpm exec playwright install chromium`。
- 如果官方 Playwright 浏览器包继续无法下载，是否可用本机 Chrome 或 Edge 完成等价 Chromium 验证。

## 风险备注

- 浏览器二进制下载慢或卡住会造成验证阻塞。
- 使用系统 Chrome/Edge 与 Playwright bundled Chromium 不是完全等价，需要在证据中说明。
