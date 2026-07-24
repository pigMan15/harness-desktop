# 知识沉淀草稿

## 来源

- RunId：`multirun-codex-terminal-implementation-20260724`
- Intent：`FEATURE`
- Risk：`HIGH`
- Phase dir：`.harness/phases/multirun-codex-terminal-implementation-20260724`
- 原始 PRD / context-pack：`multirun-codex-terminal-workflow-20260724/19-knowledge-promotion.md`、本 Run `00-context-pack.md`

## 候选知识

| 类型 | 优先级 | 领域 | 置信度 | 标题 | 相对 PRD 的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rule | 高 | Electron 打包 | 高 | pnpm hoisted 原生依赖必须先进入 staging 再由 ASAR 解包 | PRD 只要求 rebuild/unpack；实际证明 package 根 `node_modules` 超出 ASAR Main 解析边界。Forge `afterCopy` 应复制解析到的包，且 Packager 7 使用 `asar.unpackDir`，不是 `asarUnpack`。 | `16-prerelease-deployment.md` 的 ASAR resolve 失败/恢复；最终 `.unpacked` 与 Main `createRequire` PASS。 | `docs/troubleshooting.md` 与 Desktop 打包规则。 |
| pattern | 高 | 发布验证 | 高 | 原生模块包必须从 ASAR Main 的真实虚拟路径做可执行 smoke | 只检查文件存在或从 package 根 require 会产生假阳性；应从 `resources/app.asar/.vite/build/main.js` 创建 require，验证 JS 入口、`.node`、DLL 和实际 PTY 生命周期。 | `17-main-node-pty-resolution.json`、`17-packaged-pty-smoke.json`、`17-packaged-codex-tui-smoke.json`。 | `scripts/package-desktop.ps1` 后续自动化与发布检查清单。 |
| pitfall | 高 | Windows PTY | 高 | packaged Electron 的系统 ConPTY kill 辅助路径可能 AttachConsole 失败 | PRD 未规定系统 ConPTY 与 bundled DLL 的停止差异；本机证明 `useConptyDll: true` 可稳定完成 Ctrl+C、kill 和 restart。 | `16-prerelease-deployment.md` AttachConsole 失败与最终 PTY JSON PASS。 | `doc/desktop-architecture.md` TerminalManager Windows 实现备注。 |
| pitfall | 中 | Electron 供应链 | 高 | Electron ZIP cache 命中仍可能在线刷新 checksum | 仅有 ZIP cache 不保证离线；`@electron/get` 仍可能访问 `SHASUMS256.txt`。Packager `electronZipDir` 可完全绕过下载路径。 | 两次 GitHub 超时、`HARNESS_ELECTRON_ZIP_DIR` 离线 Forge 最终成功。 | `docs/troubleshooting.md` 离线构建章节。 |
| rule | 中 | Vite/Electron | 高 | Main external 必须覆盖 bare 与 `node:` 两种 builtin 拼写 | 只 externalize Electron/node-pty 不足；Vite 会把 `node:fs/promises` 等按浏览器兼容模块处理并阻止 Main bundle。 | `16-prerelease-deployment.md` 自动重试 2；`vite.main.config.ts` 与配置回归测试。 | Desktop Vite 配置规则。 |
| pitfall | 中 | Windows 测试 | 高 | 专用 worktree 的 Python 测试必须显式绑定源码路径 | 全局 editable install 可能指向主工作树，造成收集混用旧模块；发布验证应设置当前 worktree `PYTHONPATH` 并把 basetemp 放到系统临时目录。 | `13-unit-test.md` 首次收集错误和 242 项恢复结果。 | `.harness/rules/build.md` 的 Python/worktree 补充。 |
| pattern | 中 | GUI 冒烟 | 高 | GUI subsystem 的 Run-As-Node 测试使用文件哨兵并轮询 | packaged Electron launcher 可能先返回，stdout/exit code不足以证明异步 PTY 完成；一次性 JSON 哨兵可记录成功/失败并避免假阳性。 | 多个 `17-*.json` 与 `17-interface-test.md`。 | 发布测试脚本模板。 |

## 不建议沉淀的内容

- 多 Run 权威 snapshot、PTY 主链路、显式 runId、worktree 隔离和终端退出不完成节点：原始 PRD/context-pack 已明确，不属于增量知识。
- 本机 Hermes vendor 的绝对路径、端口号、进程 PID、最终资产哈希：仅属于本次主机/发布实例。
- 前几次测试脚本的引号、CR 和 health 状态字符串错误：已保留在接口证据，但不提升为长期工程规则。
- 未执行的 ARM64、其他 Windows 构建和干净 VM 结果：属于剩余风险，不是已验证知识。

## 待用户确认

- 是否将“pnpm hoisted native dependency 的 staging + `asar.unpackDir` + ASAR Main smoke”提升为 Desktop 发布硬规则。
- 是否把 `PYTHONPATH` 专用 worktree 绑定加入 Harness Python 构建规则。
- 草稿仅生成在当前 phase_dir，未自动写入长期知识库。
