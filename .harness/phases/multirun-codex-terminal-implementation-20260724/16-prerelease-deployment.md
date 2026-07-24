# 预发部署

- 环境：本机 Windows 11 x64 预发布构建；不是生产部署。
- 版本或 commit：分支 `codex/multirun-codex-terminal`，基线 `7696d4b`，未提交工作树。
- 回滚：删除本次生成的 `dist/`、`build/pyinstaller/`、`out/` 和 Desktop resources 中的冻结 Runtime，继续使用基线提交；不改动生产环境或用户数据。

## Runtime 冻结构建

- 命令：`py -3 -m PyInstaller harness-runtime.spec --clean --noconfirm --distpath ..\dist --workpath ..\build\pyinstaller`
- 工作目录：`runtime`
- 退出码：0
- 结果：PASS，生成 `dist/harness-runtime.exe`。
- SHA-256：`EB303C35C90F7265381E366C2959C3B015EAD06082BF5D74150688EA58C807D5`。
- 冒烟：从系统临时目录使用一次性 token 启动，输出 `PORT:50920`，回环 `/health` 请求未报错，stderr 为空；随后精确停止进程。
- 资源校验：复制到 `apps/desktop/resources/harness-runtime.exe` 后 SHA-256 完全一致。

## Electron Forge / Squirrel

### 首次尝试

- 命令：`pnpm.cmd exec electron-forge make --arch=x64 --out-dir=../../out`
- 退出码：1
- 结果：FAIL。
- 原因：Forge 7.4 的 `rechoir` 无法加载 `forge.config.ts`；依赖树缺少 TypeScript loader。
- 处理：固定增加 Desktop 开发依赖 `ts-node@10.9.2`，lockfile 通过供应链策略。

### 自动重试 1

- 命令：同上。
- 退出码：1
- 结果：FAIL。
- 进展：配置加载和 native dependency preparation 成功，Renderer 构建成功。
- 原因：固定版本 Forge 的 Vite plugin 要求配置显式使用 `forgeConfigSelf.entry`；Main/Preload 为 0 模块，缺少 `.vite/build/main.js`。
- 处理：按 Forge 7.4 官方模板补齐 Main/Preload entry、outDir、CJS 输出和生产环境 renderer defines；Desktop typecheck 通过。

### 自动重试 2

- 命令：同上。
- 退出码：1
- 结果：FAIL。
- 进展：Preload `preload.js` 构建成功，Renderer 1786 模块构建成功，node-pty native dependency preparation 成功。
- 最终失败：Main 构建把 `node:fs/promises`、`node:path`、`node:child_process`、`node:crypto` 等内置模块按浏览器兼容模块 externalize，未生成 `.vite/build/main.js`，Squirrel 未产生。

## 门禁结论

- `retry_counts.G7_PRERELEASE`：3；超过 workflow 最大自动重试次数 2。
- G7_PRERELEASE：BLOCKED。
- 阻塞项：`G7_PRERELEASE_retry_exhausted`。
- 没有安装包、NUPKG 或 RELEASES 文件，因此不能继续接口验收、GitHub Release 或宣称发布完成。
- 下一次获授权重试的修复方向：使用 `node:module` 的 `builtinModules`（同时包含 `node:` 形式）构造 Electron Main external 列表，再从 COMPILE/UNIT_TEST 重新验证后重试 Forge。

## 用户人工解除阻断

- 2026-07-24 用户回复“继续”，按上一轮明确请求解释为授权解除 G7 阻断并进行一次人工重试。
- 历史三次失败保留不变；新周期从 DEVELOPMENT 开始，重新执行 G3-G7。
- `retry_counts.G7_PRERELEASE` 在人工授权后重置为 0；这不是隐藏失败，失败命令和原因仍完整记录于上文。

## 人工恢复后的 Forge 成功

- 命令：`pnpm.cmd exec electron-forge make --arch=x64 --out-dir=../../out`（工作目录 `apps/desktop`）。
- 退出码：0；耗时约 105 秒。
- 结果：Vite Main `main.js`、Preload `preload.js`、Renderer 1786 模块、Electron x64 package 和 Squirrel distributable 全部成功。
- Setup：`Harness Desktop-0.1.0 Setup.exe`，128826880 字节，SHA-256 `8039D96B1C75DD7599B25811621256C97478B10CA8F51A9B6412C152AADC20D3`。
- NUPKG：`harness-desktop-0.1.0-full.nupkg`，128035796 字节，SHA-256 `81EA8565E1C290D5D1E7DC0563588099F49AD1A1D08A415B1BCCA94F28342155`。
- RELEASES：86 字节，SHA-256 `D419A9AAF014FC11E7216B57B53017B3198F2588403E9DE8A5F72AD25BE88F04`。
- 包内 Runtime：20642858 字节，SHA-256 `EB303C35C90F7265381E366C2959C3B015EAD06082BF5D74150688EA58C807D5`，与 `dist/` 和 Desktop resource 一致。
- 包内原生依赖：存在 Windows x64 `pty.node`、`conpty.node`、`conpty.dll`、`OpenConsole.exe`；ASAR 中存在 `.vite/build/main.js`、`.vite/build/preload.js` 和 Renderer 入口。
- 完整日志：`forge-manual-recovery-desktop.log`。

## G7 接口预检失败与自动恢复 1

- 真实本机 `where.exe codex`：Hermes `node/codex`、`node/codex.cmd`，随后为 WindowsApps `codex`、`codex.exe`。
- 真实版本：Hermes `.cmd` 和其 npm vendor binary 均返回 `codex-cli 0.145.0`；WindowsApps 两个候选均拒绝访问。
- 实现级真实发现结果：`available=false`。Hermes 无扩展 shim 为 `spawn ... ENOENT`，`.cmd` 为 `spawn EINVAL`，WindowsApps 为 `spawn EPERM`。
- 原因：`knownHermesCandidates` 未枚举 Hermes npm 包内的实际 `@openai/codex-win32-x64/.../bin/codex.exe`。
- G7_PRERELEASE：仍为 NOT_RUN；自动恢复计数记为 1。
- 路由：回到 DEVELOPMENT，补充实际 vendor binary 候选及回归测试；源码变化后重新执行 G3-G6，再重建和复验 G7。

## G7 恢复后的最终包重建阻塞

- 恢复验证：G3-G6 已重新通过；真实生产发现模块选中 Hermes x64 vendor `codex.exe`，版本 `codex-cli 0.145.0`。
- 最终包尝试 1：Vite Main 21.18 kB、Preload 3.96 kB、Renderer 1786 模块均成功；Electron package 在 Copying files / Preparing native dependencies 阶段连接 `20.205.243.166:443` 超时，退出码 1。日志：`forge-final.log`。
- 连通性检查：失败后 `https://github.com` HEAD 一度返回 HTTP 200；本机 Electron cache 中存在两个完整的 `electron-v31.7.7-win32-x64.zip`，各 110740332 字节，但没有独立的 checksum 缓存文件。
- 自动重试 2：同样在全部 Vite bundle 成功后连接 `20.205.243.166:443` 超时，退出码 1。日志：`forge-final-retry.log`。
- 旧产物保护：`out/` 中 Setup/NUPKG/RELEASES 和 `app.asar` 时间戳仍为 20:34-20:35，早于 Codex 发现修复，不能作为最终发布资产。
- `retry_counts.G7_PRERELEASE`：3；超过 workflow 最大自动重试次数 2。
- 状态：BLOCKED；G7_PRERELEASE 保持 NOT_RUN，由 verifier 在取得新包和接口证据后再决定。
- 阻塞项：`G7_PRERELEASE_network_retry_exhausted`。
- 建议人工恢复：授权一个新的受监督恢复周期，优先让 Forge 显式使用已有 Electron ZIP/cache 或在 GitHub 下载端点恢复后重建；不得发布旧安装包。

## 第二次人工解除阻断

- 2026-07-24 21:16 +08:00，用户再次回复“继续”，授权一个新的受监督 G7 恢复周期。
- 历史网络失败、日志和旧产物不可发布结论保持不变。
- `retry_counts.G7_PRERELEASE` 重置为 0；优先使用本机已有 Electron 31.7.7 ZIP，避免再次依赖 GitHub 下载端点。

### 离线恢复设计确认

- 本地 `@electron/get` 源码确认：ZIP cache 命中后仍以 Bypass 模式在线下载 `SHASUMS256.txt`，因此仅设置 cacheRoot 无法离线。
- 本地 `@electron/packager` 源码确认：`electronZipDir` 会直接解析 `electron-v<version>-<platform>-<arch>.zip` 并完全跳过下载功能。
- Forge make CLI 不提供 packagerConfig 覆盖参数。
- 恢复方案：在 `forge.config.ts` 增加可选 `HARNESS_ELECTRON_ZIP_DIR` 映射；未设置时保持原有在线/默认缓存行为，设置时使用已审计的本地 ZIP 目录。
- 因构建配置属于源码变更，路由 DEVELOPMENT 并重新执行 G3-G6 后再打包。

## 最终离线包与 PTY 接口预检

- 命令：设置 `HARNESS_ELECTRON_ZIP_DIR` 为已审计 Electron 31.7.7 ZIP 所在目录后运行 `pnpm.cmd exec electron-forge make --arch=x64 --out-dir=../../out`。
- Electron ZIP：110740332 字节，SHA-256 `E91986DD243D55947E6C5D3FAD21795562EC21FA0EEC5E95F7E28C830571467F`。
- 退出码：0；耗时约 62 秒；Vite Main 21.18 kB、Preload 3.96 kB、Renderer 1786 模块、Electron x64 package 和 Squirrel distributable 全部成功。
- 新产物时间：2026-07-24 23:08 +08:00；Setup/NUPKG/RELEASES 均晚于 Codex 发现修复，不再是旧包。
- Setup：128826880 字节，SHA-256 `2B9BB416E802BFE2C7BFCBB5E3F4B4C323A6DEED895D16E42C32D94BE565B3E3`。
- NUPKG：128035939 字节，SHA-256 `F5C5D44B14B0A08508760CCB1AE917E5BFAC910D44C5F633CFEBE7A2C696D3D2`。
- RELEASES：86 字节，SHA-256 `E040F38747367A16911DB1DAA6AEC228087BA250398B1133C48FD61A5378F9FA`。
- 包内 Runtime SHA-256：`EB303C35C90F7265381E366C2959C3B015EAD06082BF5D74150688EA58C807D5`；ASAR 含 Main/Preload/Renderer，包内含 Windows x64 `pty.node`、`conpty.node`、`conpty.dll` 和 `OpenConsole.exe`。
- 真实 Codex：先对 WindowsApps 两个候选得到 `spawn EPERM`，随后选中 Hermes vendor `codex.exe`，版本 `codex-cli 0.145.0`。
- 标准系统 ConPTY 模式：原生模块可以启动，但 `pty.kill()` 的 console-list 辅助进程报 `AttachConsole failed`；该模式不能作为 Stop/Restart 发布证据。
- `useConptyDll: true` 预检：两次包内 PowerShell PTY 会话完成启动、读写、resize、Ctrl+C、kill 与 restart，一次性 JSON 结果为 `PASS`。
- 结论：生产 `TerminalManager` 尚未启用已验证的 DLL 模式，G7 保持 `NOT_RUN`；恢复计数记为 1，回到 DEVELOPMENT 补 Windows spawn 选项并重新执行 G3-G7。

## 生产 PTY 修复后的最终重建尝试 1

- 命令：设置已审计 `HARNESS_ELECTRON_ZIP_DIR` 后运行 Forge make。
- 进展：Main 21.26 kB、Preload 3.96 kB、Renderer 1786 模块全部成功。
- 退出码：1。
- 失败：Packager 清理旧 `apps/desktop/out/Harness Desktop-win32-x64` 时返回 `EBUSY`；23:17 的包内 PTY 冒烟遗留孤立 `conhost` 持有旧目录。
- 处理：按 PID、进程名和启动时间验证后精确结束该 `conhost`；不终止用户 22:35 的 Electron 进程，不删除源码或生产数据。
- `retry_counts.G7_PRERELEASE`：2；允许最后一次自动重试。

## 最后一次自动重试：构建成功但正常启动失败

- Forge：退出码 0，耗时 50.8 秒；Main 21.26 kB、Preload 3.96 kB、Renderer 1786 模块、Electron x64 package 与 Squirrel 全部成功。
- Setup：128827392 字节，SHA-256 `1415F2B51D8067F28A56899130B8D803A400DAA0A380FCFECDEF903169A00421`。
- NUPKG：128035906 字节，SHA-256 `E39CDD2FBB40D4669AA406D54B7D0098BAA65B42C4CE559BCE2C5AA1CB79D993`。
- RELEASES：86 字节，SHA-256 `D25F5B2751C75792392463FDECAEB953E67B57AB28D1BB26BA76BB7F27A997FB`。
- 包内检查：ASAR Main 含生产 `useConptyDll: true`；原生 x64 文件和 Runtime 完整；两会话 PTY JSON 冒烟为 PASS。
- 正常启动：`Harness Desktop.exe` 主进程存活，但 8 秒内包内 `harness-runtime.exe` 从未出现，完整启动冒烟 FAIL。
- 根因证明：最终包 Electron 从 `resources/app.asar/.vite/build/main.js` 创建 ASAR-aware require，`resolve('node-pty')` 返回 `Cannot find module 'node-pty'`。Packager 把 node-pty 放在 package 根 `node_modules`，而 Main 的 ASAR 模块解析边界无法访问该目录。
- G7 结论：自动重试计数 3，超过上限 2；G7 仍为 NOT_RUN，当前三个 Squirrel 资产不得发布。

## 用户受监督恢复授权

- 用户本轮明确要求“提交发布”，解释为在完整保留上述失败与超限记录后继续一次受监督恢复，以交付可启动的软件，而不是发布已知损坏资产。
- 恢复方向：Forge `afterCopy` 将解析到的 node-pty 包复制进 staging app 的 `node_modules`，由现有 ASAR unpack 规则生成 `app.asar.unpacked` 与虚拟模块入口。
- 因构建配置变化，回到 DEVELOPMENT，重置 G3-G7 并重新执行全部适用门禁。

## 受监督恢复包结构预检失败 1

- Forge：staging copy 修复后退出码 0，耗时 63.3 秒；Setup/NUPKG/RELEASES 均成功生成。
- Setup：144293888 字节，SHA-256 `CA4F9B53C324575F5F32E1919C6A272F7054E893C59CF7DD8BFE90E06F9FBE82`。
- NUPKG：143568202 字节，SHA-256 `93DC2D8059E8B700CF7E56A67026CA3E599DA5047E8AD3D9FC7997B10BC43D6F`。
- RELEASES：86 字节，SHA-256 `463209A79DEDFCFE639DA4D62B3BCD00A0141AE86B5F9C8A6536913C02D29C03`。
- 进展：ASAR 从 11 个条目增至 339 个，包含 `node_modules/node-pty` JavaScript 与原生文件，证明 `afterCopy` 生效。
- 失败：`resources/app.asar.unpacked` 不存在，原生 `.node`、DLL 和 OpenConsole 仍在 ASAR 内；当前 `asarUnpack` 不是 Packager 7 `Options` 的有效字段，被静默忽略。
- 正确接口：本地 `@electron/packager` 类型与文档要求 `asar` 使用 `@electron/asar CreateOptions`，目录解包字段为 `unpackDir`。
- G7 保持 NOT_RUN；恢复计数 1，回到 DEVELOPMENT 将配置改为 `asar: { unpackDir: ... }`，随后重走 G3-G7。

## 最终预发布包成功

- 环境：本机 Windows 11 x64，离线 Electron 31.7.7 ZIP；非生产环境。
- 命令：设置 `HARNESS_ELECTRON_ZIP_DIR` 后运行 Forge make；退出码 0，耗时 62.1 秒。
- Setup：144427008 字节，SHA-256 `2F343A84DBE0454976AAADEA61CFA575FD9A3DD7FCC25E308D6EADCF76C3475D`。
- NUPKG：143775192 字节，SHA-256 `D89F0CEFFA5F7888A1B0F0965DFD200AF2D13DA2F9DF2D4E287D63E3B6916D06`。
- RELEASES：86 字节，SHA-256 `7D4BCAAD82FDD72795B6154B3CE1142D29B2D856FF97836FC6B4216BE2FB2851`。
- 包内 Runtime：20642858 字节，SHA-256 `EB303C35C90F7265381E366C2959C3B015EAD06082BF5D74150688EA58C807D5`。
- ASAR 结构：`resources/app.asar.unpacked/node_modules/node-pty` 存在，含 package.json、Windows x64 pty/conpty native modules、conpty.dll 和 OpenConsole.exe。
- Main 解析：从 `resources/app.asar/.vite/build/main.js` 创建 ASAR-aware require 后，node-pty 解析到 `app.asar/node_modules/node-pty/lib/index.js`，`spawn` 为函数。
- 正常应用启动：隐藏启动最终 `Harness Desktop.exe`，观察到 4 个 Electron 进程和 2 个包内 Runtime 进程持续存活，结果 PASS；随后按 package 精确关闭。
- Runtime health：最终包内 Runtime 输出端口，带一次性 token 的 `/health` 返回 `healthy`，stderr 为空。
- 原生 PTY：从 ASAR Main require 加载 node-pty，两个 PowerShell 会话完成 read/write、resize、Ctrl+C、kill 与 restart；`17-packaged-pty-smoke.json` 为 PASS。
- 真实 Codex：WindowsApps 两个候选均 `spawn EPERM`，发现流程继续并选择 Hermes vendor `codex.exe`，版本 `codex-cli 0.145.0`。
- 回滚：撤下三个最终资产并回退本分支提交；不删除用户项目数据或 Runtime 数据库。
- 部署结果：PASS；路由 tester 执行 `INTERFACE_TEST`，由 verifier 在部署与接口证据均存在后判定 G7。
