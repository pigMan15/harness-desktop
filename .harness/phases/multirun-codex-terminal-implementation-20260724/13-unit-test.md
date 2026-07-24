# 单元测试结果

## G7 自动恢复 1 复验（2026-07-24 20:53 +08:00）

- 命令：`pnpm.cmd test`
- 退出码：0
- 结果：PASS；Desktop 28、Renderer 16、Contracts 7，共 51 项通过，无失败。
- 覆盖重点：新增 Hermes npm vendor binary 候选测试通过，原有终端、IPC 安全、多 Run、Workflow 与契约测试保持通过。

- 无效环境命令：首次直接运行 `python -m pytest runtime/tests ...` 在收集阶段失败，原因是系统 editable install 指向主工作树，混入旧 `harness_runtime`；该命令未执行产品测试，不作为代码失败隐藏或计入 PASS。
- 修正命令：进程内设置 `PYTHONPATH=<专用 worktree>/runtime/src` 后运行 `python -m pytest runtime/tests -q -p no:cacheprovider --basetemp <系统临时目录>`。
- 修正命令退出码：0。
- 结果：PASS；收集 243 项，242 项通过，1 项因当前 Windows 主机不允许符号链接而条件跳过，无失败；仅有 FastAPI 测试依赖弃用警告。
- 后续动作：G4_UNIT_TEST 由 verifier 标记为 PASS，路由到 ATDD。

## G7 第二次人工恢复复验（2026-07-24 21:27 +08:00）

- 命令：`pnpm.cmd test`；退出码 0；Desktop 29、Renderer 16、Contracts 7，共 52 项通过。
- 命令：绑定 `PYTHONPATH=<专用 worktree>/runtime/src` 后运行完整 pytest，并使用系统临时 `--basetemp`；退出码 0。
- Runtime 结果：242 项通过，1 项因主机符号链接权限按条件跳过，无失败；仅有已知依赖弃用警告。
- 结果：PASS；路由 ATDD。

## Desktop、Renderer 与 Contracts

- 命令：`pnpm.cmd test`
- 工作目录：`G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724`
- 退出码：0
- 结果：PASS
- 聚焦结果：Desktop 25 项、Renderer 16 项、Contracts 7 项，共 48 项测试通过。
- 覆盖重点：Codex 候选发现、PTY 所有权和并发限制、停止/重启/中断、脱敏、preload 安全边界、selected Run 切换、Terminal 页面、Workflow 草稿 Undo/Redo 与契约方法。

## Runtime 完整测试

- 命令：`python -m pytest runtime/tests -q -p no:cacheprovider --basetemp <系统临时目录>/pytest`
- 工作目录：同上
- 退出码：0
- 结果：PASS
- 聚焦结果：243 项已收集，242 项通过，1 项跳过，无失败。
- 覆盖重点：显式 Run 上下文、独立 revision/worktree、节点 artifact/revision/人工确认和审计、动态 Gate/waiver/retry、Workflow 校验/ZIP/版本恢复、终端投影、诊断脱敏、项目恢复和既有 Runtime 回归。

## 跳过项说明

- 复核命令：`python -m pytest runtime/tests/projects/test_bootstrap.py -q -rs -p no:cacheprovider --basetemp <系统临时目录>/pytest`
- 退出码：0
- 结果：5 项通过，1 项跳过。
- 原因：当前 Windows 测试主机不允许创建符号链接，`test_bootstrap.py:73` 按环境能力跳过符号链接场景；不是实现失败，且路径逃逸/普通文件约束有其他测试覆盖。

## 结论

- G4_UNIT_TEST：PASS。
- 没有未解释的相关失败测试，也没有 Gate 豁免。
- 后续动作：路由到 `ATDD / verifier`。

## ATDD 修复后复验

- `pnpm.cmd test`：退出码 0；Desktop 25、Renderer 16、Contracts 7 项通过。
- 完整 Runtime：退出码 0；242 项通过，1 项按相同主机符号链接限制跳过。
- 结果：PASS，无新增回归。

## G7 人工恢复后复验

- `pnpm.cmd test`：退出码 0；Desktop 27、Renderer 16、Contracts 7，共 50 项通过。
- 完整 Runtime：退出码 0；242 项通过，1 项按既有主机符号链接限制跳过。
- 新增覆盖：Forge TS loader、node-pty asar unpack、Electron Main builtin external 列表。
- 结果：G4_UNIT_TEST 再次 PASS，无相关失败。
# G7 PTY 恢复复验（2026-07-24 23:34 +08:00）

- 首次 Runtime 命令：`python -m pytest runtime/tests -q -p no:cacheprovider --basetemp <系统临时目录>`；退出码：1；收集 5 个错误。
- 首次失败原因：系统 Python editable install 指向主工作树，导入路径显示 `G:\Project\ai\harness-desktop\runtime\src`，未使用专用 worktree 源码；失败未隐藏。
- 修正命令：将 `PYTHONPATH` 显式设为当前 worktree 的 `runtime/src` 后运行同一全量测试；退出码：0；`242 passed, 1 skipped`，跳过项为主机不允许符号链接的条件场景。
- TypeScript 命令：`pnpm.cmd test`；退出码：0；Desktop 30、Renderer 16、Contracts 7，共 53 项通过。
- 聚焦红绿：Windows ConPTY DLL 新测试先以 `windowsPtyOptions is not a function` 失败，最小实现后 Desktop 30/30 通过。
- 结果：PASS；没有未解释的相关失败。
- 后续动作：进入 ATDD，重跑 4 项 Playwright 场景。
# ASAR Main 依赖恢复复验（2026-07-25 00:07 +08:00）

- `pnpm.cmd test`：退出码 0；Desktop 31、Renderer 16、Contracts 7，共 54 项通过。
- 绑定专用 worktree `PYTHONPATH` 后运行完整 Runtime pytest：退出码 0；`242 passed, 1 skipped`。
- 聚焦 TDD：staging copy 配置测试先红后绿，Desktop 最终 31/31。
- 结果：PASS；进入 ATDD。
# Packager unpackDir 恢复复验（2026-07-25 00:20 +08:00）

- TypeScript：Desktop 31、Renderer 16、Contracts 7，共 54 项通过。
- Runtime：绑定专用 worktree PYTHONPATH，`242 passed, 1 skipped`。
- 结果：PASS；进入 ATDD。
