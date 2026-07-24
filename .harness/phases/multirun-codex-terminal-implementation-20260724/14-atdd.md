# ATDD 场景验证

## G7 自动恢复 1 复验（2026-07-24 21:07 +08:00）

- 初始环境失败：`pnpm.cmd test:e2e -- --reporter=line` 因 Playwright 缓存的 Chromium executable 已不存在，1 个非浏览器 fixture 通过、3 个浏览器场景在启动前失败；不是场景断言失败。
- 第二次基础设施失败：显式系统 Chrome 后，Playwright webServer 父进程等待链在 300 秒超时；Vite 子进程实际已在 `127.0.0.1:4173` 返回 HTTP 200，Chrome 尚未启动。遗留进程按 PID、路径和启动时间精确清理。
- 成功命令：设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`，复用已验证的 Vite server，运行 `pnpm.cmd exec playwright test --reporter=line --workers=1`。
- 成功结果：退出码 0，4 项场景全部通过，耗时 1.8 秒。
- 场景输出：Run 切换显示其独立活动终端；Workflow Studio 提供 routes/recovery/rules/YAML/versions；项目 fixture 和 Renderer CSP/root mount 场景通过。
- 清理：成功后精确停止本次 Vite server；未保留后台 Node/Chrome 测试进程。
- 结论：G5_ATDD PASS；路由到 EVIDENCE_CAPTURE。

## G7 第二次人工恢复复验（2026-07-24 21:30 +08:00）

- 测试环境：直接以隐藏 Node 进程启动 Vite，确认 `127.0.0.1:4173` 返回 HTTP 200；Playwright 使用系统 Chrome 和单 worker 复用 server。
- 命令：`pnpm.cmd exec playwright test --reporter=line --workers=1`。
- 结果：退出码 0，4 项场景全部通过，耗时 1.7 秒。
- 清理：按 PID、进程路径精确停止 Vite Node 进程。
- 结论：G5_ATDD PASS；路由 EVIDENCE_CAPTURE。

## 执行环境

- 浏览器：本机 Google Chrome，通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 提供给 Playwright Chromium 项目。
- Renderer：Vite 本地服务，`http://127.0.0.1:4173`。
- 工作目录：`G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724`。

## 命令

- 命令：`pnpm.cmd test:e2e -- --reporter=line`
- 退出码：1
- 结果：FAIL

## 场景结果

- PASS：有效/无效 Harness fixture 可用于项目导入场景。
- PASS：Renderer 入口保留 root mount point 和 CSP。
- FAIL：从 Runs 页选择 `run-b` 并点击运行中终端后，5 秒内没有找到标题为 `Terminal` 的页面。
- PASS：Workflow Studio 展示 Routes、Nodes、Recovery、Rules、YAML 和 Versions，并可进入 Effective hard rules。

## 失败证据

- 失败位置：`tests/e2e/multirun-terminal-workflow.spec.ts:39`。
- Playwright 报错：`getByRole('heading', { name: 'Terminal' })` 未找到可见元素。
- 失败产物：`test-results/multirun-terminal-workflow-fe5f7-independent-active-terminal-chromium/error-context.md`（回退修复期间可用于定位，最终证据将引用重试结果）。

## 门禁结论

- 首次 G5_ATDD：FAIL。
- 首次 `retry_counts.G5_ATDD`：1。
- 恢复路由：依据 `workflow.failure_recovery.gate_to_node.G5_ATDD` 回退到 `DEVELOPMENT / developer`，没有在 verifier 角色内实施修复。

## 重试 1

- 命令：`pnpm.cmd test:e2e -- --reporter=line`
- 浏览器：本机 Google Chrome，Chromium 项目。
- 退出码：0
- 结果：PASS，4/4 场景通过。
- 关键场景：Run 切换后进入 `run-b` 的独立活动终端并显示 worktree/session；Workflow Studio 全部配置标签可见；项目导入 fixture 和 Renderer CSP 场景通过。
- 最终 G5_ATDD：PASS。
- 重试计数：通过后清除。

## G7 人工恢复后复验

- 命令：`pnpm.cmd test:e2e -- --reporter=line`
- 退出码：0
- 结果：PASS，4/4 场景通过。
- 覆盖：项目导入 fixture、Renderer CSP、独立 Run 终端导航、Workflow Studio 全配置标签。
- G5_ATDD 再次 PASS。
# G7 PTY 恢复复验（2026-07-24 23:41 +08:00）

- 首次命令：`pnpm.cmd test:e2e -- --reporter=line`；结果：FAIL，三个浏览器场景在 launch 阶段提示 Playwright 1228 headless shell 不存在；失败进程未自行退出，已精确终止。
- 恢复命令：设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` 后执行同一命令。
- 场景输出：多 Run 选择显示独立活动终端 PASS；Workflow Studio routes/recovery/rules/YAML/versions PASS；两项项目导入/Renderer 框架场景 PASS。
- 退出码：0；`4 passed (1.8s)`。
- 结果：PASS；首次失败属于缺少 Playwright 自带浏览器的环境调用问题，系统 Chrome 复验覆盖相同场景。
- 后续动作：进入 EVIDENCE_CAPTURE。
# ASAR Main 依赖恢复复验（2026-07-25 00:08 +08:00）

- 使用系统 Chrome 执行 `pnpm.cmd test:e2e -- --reporter=line`。
- 退出码：0；多 Run 独立终端、Workflow Studio 全标签和两项项目导入/Renderer 场景共 `4 passed (1.6s)`。
- 结果：PASS；进入 EVIDENCE_CAPTURE。
# Packager unpackDir 恢复复验（2026-07-25 00:21 +08:00）

- 系统 Chrome 下 4 项 Playwright 场景全部通过，耗时 1.6 秒。
- 结果：PASS；进入 EVIDENCE_CAPTURE。
