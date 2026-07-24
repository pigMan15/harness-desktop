# 接口测试

## 测试目标

- 验证 2026-07-25 00:24 +08:00 生成的 Windows x64 package 与 Squirrel 资产，不使用更早的过期包。
- 验证 ASAR Main 能解析原生 node-pty、正常应用能启动包内 Runtime、Runtime 鉴权 health、真实 Codex 发现和 PTY 生命周期。

## 场景

### 1. 最终资产与包结构

- 命令或请求：计算 Setup/NUPKG/RELEASES/包内 Runtime SHA-256；枚举 `resources/app.asar.unpacked/node_modules/node-pty`。
- 结果：PASS。
- Setup：144427008 字节，`2F343A84DBE0454976AAADEA61CFA575FD9A3DD7FCC25E308D6EADCF76C3475D`。
- NUPKG：143775192 字节，`D89F0CEFFA5F7888A1B0F0965DFD200AF2D13DA2F9DF2D4E287D63E3B6916D06`。
- RELEASES：86 字节，`7D4BCAAD82FDD72795B6154B3CE1142D29B2D856FF97836FC6B4216BE2FB2851`。
- Runtime：20642858 字节，`EB303C35C90F7265381E366C2959C3B015EAD06082BF5D74150688EA58C807D5`。
- `.unpacked` 包含 package.json、Windows x64 pty/conpty 原生模块、conpty.dll 和 OpenConsole.exe。

### 2. ASAR Main 模块解析

- 命令或请求：最终包 Electron 在 `ELECTRON_RUN_AS_NODE` 下，从 `resources/app.asar/.vite/build/main.js` 创建 `createRequire`，解析并加载 node-pty。
- 输出：`insideAsar=true`，解析到 `app.asar/node_modules/node-pty/lib/index.js`，`spawnType=function`。
- 结果：PASS。

### 3. 正常应用与 Runtime 启动

- 命令或请求：隐藏启动最终 `Harness Desktop.exe`，连续 8 秒采样 package 路径进程，然后精确关闭。
- 输出：`MainExited=false`、`ElectronProcesses=4`、`RuntimeSeen=true`、`RuntimeProcesses=2`。
- 结果：PASS。

### 4. Runtime 鉴权 health

- 命令或请求：使用 64 字符一次性 token 启动最终包内 Runtime，读取 `PORT`，请求回环 `/health`，请求头含 Bearer token 与 Desktop 版本。
- 输出：端口 `52279`，`Status=healthy`，`StderrEmpty=true`。
- 结果：PASS；token 未写入产物或输出。

### 5. 最终包原生 PTY

- 命令或请求：从 ASAR Main require 加载 node-pty，使用生产 `useConptyDll` 模式依次启动两个 PowerShell PTY。
- 输出：`17-packaged-pty-smoke.json` 为 PASS；`spawn=2`、read/write、resize、Ctrl+C、kill、restart 全为 true。
- 内容输出：`17-packaged-terminal-content-smoke.json` 为 PASS；ANSI、中文、粘贴写入和 resize 全为 true。
- 真实 TUI：`17-packaged-codex-tui-smoke.json` 为 PASS；真实 Hermes Codex TUI 产生 3257 字节 ANSI 输出，Ctrl+C 后受控停止；未保存原始输出。
- 结果：PASS。

### 6. 真实 Codex 发现

- 命令或请求：执行生产 discovery 模块，先探测 WindowsApps，再探测 Hermes 与 PATH，并直接运行 `codex --version`。
- 输出：WindowsApps 两个候选均 `spawn EPERM`；流程继续，选择 Hermes x64 vendor `codex.exe`；版本 `codex-cli 0.145.0`。
- 结果：PASS。

### 7. UI 场景

- 命令或请求：系统 Chrome 执行 Playwright 多 Run/终端/Workflow Studio/项目导入场景。
- 输出：`4 passed (1.6s)`。
- 结果：PASS。

## 失败

- 第一次最终 Runtime health 脚本使用了 Windows PowerShell 5 不支持的静态随机数 API，未得到产品结果；已改用两个 GUID 组成一次性 token。
- 第二次 health 请求实际返回 `healthy` 且 stderr 为空，但脚本错误要求 `ok`，因此退出 1；按 Runtime 真实契约修正后退出 0。
- 首次终端内容脚本在外层 PowerShell 引号解析阶段失败，未启动产品；第二次把 CR 写成字面量 `\\r`，真实 PTY 正确回显但命令未执行并超时；使用真实字符 13 后通过。
- 历史 package 的 ASAR node-pty 解析失败、无 `.unpacked`、系统 ConPTY AttachConsole 和 Forge EBUSY/网络失败均保留在 `16-prerelease-deployment.md`，未被最终结果覆盖。

## 剩余风险

- 当前基础设施没有干净 Windows VM，未执行全新安装、旧版升级和卸载残留检查。
- 当前环境没有代码签名证书，最终 Squirrel 资产未签名，可能触发 Windows SmartScreen。
- Renderer 主 JavaScript chunk 约 696 kB，属于后续性能优化项。

## 结论

- 本机预发布部署与接口检查：PASS。
- G7 是否通过由 verifier 根据 `16-prerelease-deployment.md` 与本文件共同判定。
