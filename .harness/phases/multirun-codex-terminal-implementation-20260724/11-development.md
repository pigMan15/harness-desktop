# Development Record

## Status

- Coding design confirmed by the user on 2026-07-24.
- Implementation completed in dedicated worktree `G:\Project\ai\harness-desktop\.worktrees\multirun-codex-terminal-implementation-20260724`.
- Branch: `codex/multirun-codex-terminal`; baseline: `7696d4b`.
- Developer handoff target: `COMPILE / verifier`. G3-G8 remain `NOT_RUN` until their owning roles execute them.

## Search Findings

- Authoritative Run state is `.harness/runs/<run_id>/state.json`; root `.harness/state.json` remains a selected-Run compatibility projection.
- Existing Runtime project registry, state store, workflow compiler/draft service, Gate engine, and Electron preload boundary were reused rather than duplicated.
- Existing `execution` app-server implementation remains source-only diagnostic compatibility. The product route now uses the native PTY terminal.
- SQLite already had a rebuildable `audit_events` projection; node lifecycle RPCs were connected to it after a focused audit test exposed the missing write.

## TDD Journal

### Contracts and explicit Run context

- Selected tests: `packages/contracts/tests/rpc.test.ts`, Run service tests, WorkspaceContext source contracts.
- Initial failure: new explicit `runId`, terminal session, workflow version/import/export, node lifecycle, and project recovery methods were absent from the shared contract.
- Implementation: extended TypeScript and JSON RPC contracts; normalized Renderer state to `selectedRunId`, `runsById`, and `terminalSessionsById`; made Runtime business APIs explicitly Run-scoped.
- Focused result: Contracts `7 passed`; WorkspaceContext `3 passed`; Runtime Run service `21 passed`.
- Extended result: TypeScript workspace typecheck passed; full Runtime suite `242 passed, 1 skipped`.

### Codex discovery and native PTY

- Selected tests: `codex-discovery.test.ts`, `terminal-manager.test.ts`, desktop security contracts, TerminalPage source tests.
- Initial failure: no user/HARNESS_CODEX_PATH/Hermes/PATH discovery chain, direct probe, native PTY ownership, replay, limits, rotation, or typed preload surface existed.
- Implementation: added direct `codex --version` probing with candidate continuation, atomic AppData settings, `node-pty` TerminalManager, bounded scrollback/logging, ownership checks, lifecycle events, xterm UI, stop/restart/search/copy/paste/resize/Ctrl+C handling, and native packaging configuration.
- Focused result: Desktop `25 passed`; Renderer terminal tests `2 passed`; renderer security assertions passed.
- Extended result: Desktop/Renderer/Contracts aggregate `48 passed`; typecheck passed.

### Workflow, Gate, node lifecycle, and recovery

- Selected tests: workflow draft/compiler/version/ZIP tests, Gate engine tests, multi-Run API tests, node service tests, terminal projection tests.
- Initial failure: structured preview discarded unedited workflow sections; Gate artifacts were fixed; node completion lacked artifact/revision/confirmation enforcement; workflow versions/import/export and terminal projections were not exposed through Runtime.
- Implementation: added structured/YAML preview, semantic diff, atomic apply, ZIP manifest verification, versions/restore, dynamic Gates and waivers, retry recovery, node complete/confirm/reject, project repair/relocate/unregister, bounded diagnostics, and terminal projections.
- Focused result: Runtime feature-focused tests `61 passed` before the final audit slice.
- Final audit red: `test_run_context_and_node_complete_are_explicitly_run_scoped` failed with `IndexError` because `audit_events` was empty after `node.complete`.
- Final audit green: added node completion/confirmation audit writes and API coverage; multi-Run API `7 passed`, node/API focused suite `10 passed`.
- Extended result: full Runtime suite `242 passed, 1 skipped`; no Runtime test failures.

## Changed Modules

- Contracts and protocol: `packages/contracts/src/rpc.ts`, `schemas/rpc.schema.json`, matching contract tests.
- Electron Main/Preload: `codex-discovery.ts`, `terminal-manager.ts`, IPC registration, typed preload APIs, Forge/Vite native-module packaging, and security tests.
- Renderer: WorkspaceContext, Runs, Terminal, Settings, Workflow Studio, Gates, Artifacts, Recovery, Projects, navigation, styles, unit tests, and Playwright ATDD fixture.
- Runtime: explicit Run lifecycle/context, mandatory worktrees, node service and audit, dynamic Gate evaluation/waivers/recovery, terminal projections, diagnostics, workflow drafts/ZIP/version restore, project repair/relocate/unregister, API dispatch, database migration, and shutdown interruption handling.
- Documentation and release plumbing: README files, user/workflow/troubleshooting/architecture docs, changelog, workspace dependencies, and `scripts/package-desktop.ps1`.

## Chinese Comment Scope

- `apps/desktop/src/main/codex-discovery.ts`: candidate probe continuation after inaccessible WindowsApps entries.
- `apps/desktop/src/main/terminal-manager.ts`: trusted executable/cwd ownership, stop/exit ordering, shutdown interruption semantics, and bounded AppData log rotation.
- `apps/renderer/src/features/layout/WorkspaceContext.tsx`: selected Run is a view projection and must not terminate other sessions.
- `runtime/src/harness_runtime/api/app.py`: project identity boundary, active terminal projection, node audit ordering, Gate authority/recovery/waiver invariants, and trusted Codex context.
- `runtime/src/harness_runtime/nodes/service.py`: Runtime-owned human confirmation metadata.
- `runtime/src/harness_runtime/runs/service.py`: phase creation, root projection, and mandatory-worktree no-fallback invariants.
- `runtime/src/harness_runtime/workflow/drafts.py`: preservation of unedited routes/rules and atomic revalidation before apply.
- `runtime/src/harness_runtime/diagnostics/service.py`, `main.py`, `database.py`, `projects/service.py`, and `protocol/loader.py`: redaction, interrupted projection, migration, rollback, and Run artifact boundaries.

## Developer Verification

- `pnpm.cmd typecheck`: exit 0.
- `pnpm.cmd test`: exit 0; Desktop 25, Renderer 16, Contracts 7 tests passed.
- `pnpm.cmd lint`: exit 0.
- Full Runtime command used an isolated system temp directory and `--basetemp`: exit 0; `242 passed, 1 skipped`.
- `git diff --check`: exit 0; only configured Windows line-ending notices were emitted.

## G5 ATDD Retry 1

- Red: Playwright initially reported 3 passed / 1 failed because Runs-to-Terminal navigation did not reach the Terminal page. After request coalescing, navigation succeeded but the Terminal context crashed because the ATDD bridge lacked the new scrollback/write/resize methods.
- Root cause: selected Run state could be read before `runsById` initialization and repeated selection requests could use the same stale revision; the ATDD preload substitute also lagged behind the typed terminal API.
- Implementation: `WorkspaceContext.selectRun` now loads a missing Run from Runtime and coalesces concurrent selection of the same Run; the Playwright bridge implements bounded scrollback, write, and resize stubs matching the real preload contract.
- Focused result: Renderer typecheck passed; Renderer 16 tests passed.
- Scenario result: Playwright 4 tests passed, including independent active-terminal navigation and complete Workflow Studio tabs.
- Reverification requirement: because Renderer code changed, G3/G4/G5 are reset to `NOT_RUN` and verification restarts at COMPILE. `retry_counts.G5_ATDD` remains 1 until ATDD passes under verifier.

## G7 Manual Recovery

- Authorization: after G7 exhausted automatic retries, the user replied `continue`, authorizing one manually supervised recovery cycle.
- Red evidence: Forge attempt 3 built Preload and Renderer but Vite treated `node:*` imports in Electron Main as browser compatibility modules, so `.vite/build/main.js` was not generated.
- Implementation: Main Vite config now enumerates `node:module.builtinModules` and externalizes both bare and `node:` spellings together with Electron and node-pty.
- Regression guard: added `apps/desktop/tests/packaging-config.test.ts` for the Forge TS loader, node-pty asar unpacking, and builtin external coverage.
- Focused result: Desktop typecheck passed; Desktop 27 tests passed.
- Reverification requirement: G3-G7 were reset to `NOT_RUN`; verification restarts at COMPILE before any new package attempt.

## Acceptance Coverage Handoff

- Criteria 1-19 have implementation and focused automated coverage across Runtime, Desktop, Renderer, and the web ATDD fixture.
- Criterion 20 remains verifier/deployer work: full build, Playwright ATDD rerun, real local Codex probe/PTY smoke, frozen Runtime build, Squirrel package smoke, release hashes, and Windows installation evidence.
- Clean Windows VM, upgrade/uninstall, and code-signing checks depend on available release infrastructure. They must be recorded as evidence-backed PASS, explicit WAIVED with owner/scope/reason/time, or BLOCKED; they must not be inferred.

## G7 Automatic Recovery 1: Real Hermes Discovery

- Red evidence: the release precheck executed the production discovery module against the local installation and returned `available=false`; Hermes `node/codex` failed with `ENOENT`, `node/codex.cmd` with `EINVAL`, and WindowsApps candidates with `EPERM`.
- Root cause: Hermes installs the required ordinary file under its npm package at `@openai/codex-win32-x64/.../vendor/x86_64-pc-windows-msvc/bin/codex.exe`, but `knownHermesCandidates` did not enumerate that path.
- TDD red: the new vendor-path test failed while the other 27 Desktop tests passed.
- Implementation: enumerate nested and hoisted x64/arm64 Hermes npm vendor layouts while preserving direct `execFile`, ordinary-file, and no-shell constraints.
- Chinese comment: `apps/desktop/src/main/codex-discovery.ts` explains why shell/cmd shims are skipped in favor of the ordinary vendor file.
- TDD green: all 28 Desktop tests passed.
- Real smoke: production discovery returned `available=true`, source `hermes`, version `codex-cli 0.145.0`, and the absolute x64 vendor `codex.exe` path.
- Changed files: `apps/desktop/src/main/codex-discovery.ts`, `apps/desktop/tests/codex-discovery.test.ts`.
- Handoff: source changed after the first package, so G3-G6 must be rerun and the Windows distributables rebuilt before G7 can pass.

## G7 第二次人工恢复：离线 Electron ZIP

- 根因证据：`@electron/get` 在 ZIP cache 命中后仍以 Bypass 模式刷新 `SHASUMS256.txt`；`@electron/packager` 的 `electronZipDir` 则完全跳过下载分支。
- TDD 红：新增离线 ZIP 配置测试失败，其余 28 项 Desktop 测试通过。
- 实现：`forge.config.ts` 将可选构建环境变量 `HARNESS_ELECTRON_ZIP_DIR` 映射为 Packager `electronZipDir`；未设置时默认行为不变。
- 中文注释：说明仅显式发布环境启用本地 ZIP，并保留 Packager 对目录和精确版本文件名的校验。
- TDD 绿：Desktop 29 项全部通过。
- Changed files：`apps/desktop/forge.config.ts`、`apps/desktop/tests/packaging-config.test.ts`。
- Handoff：构建配置变化后重新执行 G3-G6，再以本机 Electron 31.7.7 ZIP 目录执行 Forge/Squirrel。

## G7 恢复 1：打包宿主 PTY Stop/Restart

- 接口红证据：最终离线包在系统 ConPTY 模式启动成功，但 `pty.kill()` 的 console-list 辅助进程报 `AttachConsole failed`；该路径不能支撑 Stop/Restart 发布声明。
- 实际对照：同一最终包设置 `useConptyDll: true` 后，一次性 JSON 记录两次 PowerShell PTY 会话的 read/write、resize、Ctrl+C、kill 和 restart 全部 `PASS`。
- TDD 红：新增 `uses the bundled ConPTY DLL only on Windows` 后，Desktop 30 项中仅该项失败，原因为 `windowsPtyOptions is not a function`。
- 实现：默认 node-pty spawn 在 Windows 经 `windowsPtyOptions` 增加 `useConptyDll: true`；Linux 等平台保持原参数不变，注入的测试 PTY 接口也不改变。
- 中文注释：`apps/desktop/src/main/terminal-manager.ts` 说明系统 ConPTY kill 辅助进程在打包宿主中的 AttachConsole 风险，以及随包 DLL 直接关闭会话句柄的原因。
- TDD 绿：Desktop 30 项全部通过。
- Changed files：`apps/desktop/src/main/terminal-manager.ts`、`apps/desktop/tests/terminal-manager.test.ts`。
- Handoff：生产代码变化后重新执行 G3-G6，离线重建 Setup/NUPKG/RELEASES，并用生产默认选项重跑最终包 PTY 冒烟。

## G7 受监督恢复：ASAR Main 原生依赖解析

- 接口红证据：最终 package 的 Electron 主进程存活但 Runtime 从未启动；从 `resources/app.asar/.vite/build/main.js` 创建 ASAR-aware require 后，`resolve('node-pty')` 明确返回 `Cannot find module`。
- 根因：pnpm hoisted node-pty 被 Packager 放在 package 根 `node_modules`，超出 ASAR Main 的模块解析边界；已有 `asarUnpack` glob 没有 staging 内的包可标记。
- TDD 红：新增 staging copy 配置测试后，Desktop 31 项中仅该项失败，缺少 `createRequire`、`copyNodePtyToStaging` 和 `afterCopy`。
- 实现：Forge 使用配置位置的 `createRequire` 解析实际 node-pty 包，`afterCopy` 将其递归复制到 staging `node_modules/node-pty`，再交给现有 native rebuild 与 ASAR unpack。
- 中文注释：`apps/desktop/forge.config.ts` 说明 hoisted 依赖为何必须进入 staging，避免只复制原生二进制而丢失 JavaScript 模块入口。
- TDD 绿：Desktop 31 项全部通过；Desktop typecheck 通过。
- Changed files：`apps/desktop/forge.config.ts`、`apps/desktop/tests/packaging-config.test.ts`。
- Handoff：构建配置变化后重新执行 G3-G6；最终 package 必须证明 ASAR Main 可解析 node-pty、正常应用启动 Runtime、Runtime health 和生产 PTY 冒烟通过。

## G7 自动恢复 1：Packager 7 原生目录解包

- 包结构红证据：staging copy 后 ASAR 已含 339 个条目和 node-pty 全包，但 `app.asar.unpacked` 不存在，原生 `.node`、DLL 与 OpenConsole 仍被压入 ASAR。
- 根因：`asarUnpack` 不是当前 `@electron/packager Options` 字段；本地类型与文档规定 `asar` 使用 `@electron/asar CreateOptions`，目录字段为 `unpackDir`。
- TDD 红：测试要求 `asar: { unpackDir: path.join('node_modules', 'node-pty') }` 且禁止 `asarUnpack` 后，Desktop 31 项中仅该项失败。
- 实现：将配置替换为 Packager 7 有效的 `asar.unpackDir`；staging hook、native rebuild 与其他发布设置不变。
- TDD 绿：Desktop 31 项全部通过；Desktop typecheck 通过。
- Changed files：`apps/desktop/forge.config.ts`、`apps/desktop/tests/packaging-config.test.ts`。
- Handoff：重新执行 G3-G6；最终包必须实际存在 `resources/app.asar.unpacked/node_modules/node-pty`，不能只依赖配置文本测试。
