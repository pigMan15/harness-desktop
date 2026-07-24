# 验收报告

## 范围

- 本期交付多 Run 权威状态与 worktree 隔离、Run-bound Codex 原生 PTY、显式 Run 上下文、节点/Gate 闭环、完整线性 Workflow Studio、恢复/诊断和 Windows x64 打包。
- 非目标保持不变：不以 app-server 为主链路，不实现 DAG/循环/条件 Workflow，不承诺应用重启后重新附着原始 PTY。

## 验收映射

| 标准 | 结果 | 主要证据 |
| --- | --- | --- |
| AC-01 | PASS | Runtime 多 Run API 测试覆盖 A/B/C snapshot、phase_dir、revision 和 list。 |
| AC-02 | PASS | worktree manager 与 Run service 覆盖独立 branch/path、失败 BLOCKED、无共享根回退。 |
| AC-03 | PASS | WorkspaceContext 单测与 Playwright 覆盖 selected Run 恢复和不修改其他 Run。 |
| AC-04 | PASS | Contracts、preload 与 Renderer 页面统一显式 projectId/runId；类型检查通过。 |
| AC-05 | PASS | TerminalManager 多 Run 测试与多 Run API/ATDD 覆盖独立 session/cwd/sequence。 |
| AC-06 | PASS | 停止 Run A 不影响 Run B 的单测和切换 Run ATDD 通过。 |
| AC-07 | PASS | TerminalManager 覆盖同节点唯一活动 session、项目与全局上限。 |
| AC-08 | PASS | 真实 WindowsApps 两次 EPERM 后选中 Hermes vendor 0.145.0。 |
| AC-09 | PASS | 最终 ASAR PTY 生命周期、ANSI/中文/粘贴、resize、Ctrl+C、stop/restart 与真实 Codex TUI smoke 通过。 |
| AC-10 | PASS | Desktop security 8 项测试、sandbox/contextIsolation 和受控 IPC/ownership 通过。 |
| AC-11 | PASS | node service/API 测试覆盖 stale revision、artifact 缺失/空/越界及原子推进。 |
| AC-12 | PASS | confirmation metadata、终端退出不完成节点和 verifier Gate 权限测试通过。 |
| AC-13 | PASS | Gate engine 覆盖动态 required artifacts、自定义 Gate 与带元数据 waiver。 |
| AC-14 | PASS | Gate recovery 测试覆盖 retry、配置目标和第三次 BLOCKED。 |
| AC-15 | PASS | Workflow draft/Renderer 测试覆盖自定义节点、role/artifact/gate、全部 route。 |
| AC-16 | PASS | Workflow Studio recovery/rules/undo/redo 单测与 ATDD 通过。 |
| AC-17 | PASS | Runtime YAML/ZIP、manifest/hash、diff/apply/version/restore 测试通过。 |
| AC-18 | PASS | 非法 Workflow/ZIP 原子性和 frozen Run route 测试通过。 |
| AC-19 | PASS | shutdown interruption、bounded/redacted diagnostics 测试通过，节点不自动完成。 |
| AC-20 | PASS（含豁免） | 54 项 TypeScript、242 项 Runtime、4 项 Playwright、真实 Codex、最终 package/Runtime/PTY/installer hashes 均有证据；干净 VM 与签名按下述豁免。 |

## 验证汇总

- G3：全仓 TypeScript typecheck、Renderer 1786 模块构建、Runtime compileall 通过。
- G4：Desktop 31、Renderer 16、Contracts 7，共 54 项通过；Runtime `242 passed, 1 skipped`。
- G5：系统 Chrome 下 4 项 Playwright 场景通过。
- G7：最终 Forge/Squirrel、ASAR unpack/resolve、正常应用与 Runtime、health、真实 Codex 和 PTY 接口通过。
- 最终资产哈希记录在 `16-prerelease-deployment.md` 与 `17-interface-test.md`。

## 豁免与剩余风险

- 干净 Windows VM 的安装、升级、卸载由项目发布负责人豁免：当前没有可重置 VM；本机 package 正常启动与接口 smoke 已通过。
- Windows 代码签名由项目发布负责人豁免：没有证书或签名服务；未签名 Setup 可能触发 SmartScreen。
- 仅构建并验证 Windows x64；未验证 ARM64 和其他 Windows 构建版本。
- Renderer 主 JavaScript chunk 约 696 kB，属于性能优化风险。

## 交付结论

- 本地功能、门禁和 Windows x64 发布资产满足已确认验收标准，建议 G8 PASS。
- 源码 commit、分支 push、GitHub Release 与远端资产核对仍是用户要求的必做交付；完成前 run 不应标记 DONE。
