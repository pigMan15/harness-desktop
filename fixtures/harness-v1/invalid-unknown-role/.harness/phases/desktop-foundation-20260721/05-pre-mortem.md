# 失败预演 — Harness Desktop Foundation (M1)

节点：PRE_MORTEM　角色：quality-guardian　产物：`05-pre-mortem.md`
上游：`03-solution-design.md`、`04-solution-confirmation.md`
参考：`.harness/context/premortem.md`

假设 M1 上线后已发生故障：71 个文件已提交，pnpm workspace 可构建，Runtime 可认证，Electron 壳可启动——但某处出了问题。以下是反推的故障模式与对策。

## 失败模式

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| **pnpm install 在 Windows 上失败** | 路径过长（Windows 260 字符限制）、npm registry 不可达、pnpm 版本不兼容 | `.gitignore` 排除 `node_modules`；`package.json` 声明 `engines.pnpm`；CI 用 Windows runner 验证 | `pnpm install` 非零退出码；CI 红 | 降级 pnpm 版本；使用 npm/yarn 备用 |
| **Electron Forge 脚手架与 Vite 模板冲突** | `forge.config.ts` 与 Vite 配置不兼容；sandbox/CSP 选项冲突 | Forge init 后先跑 `pnpm dev` 验证空壳启动，再逐步加配置 | `pnpm --filter @harness/desktop dev` 启动失败或白屏 | 回退为最小 Forge 配置；手动配 Vite |
| **Python 子进程无法启动** | Windows app execution alias 拦截（Git Bash 下 `python`/`python3` 被 Store 重定向）、PATH 无 Python、`py -3` 不可用 | `RuntimeSupervisor` 优先探测 `py -3`，其次全路径 `python.exe`，最后用户配置 Python 路径 | `RuntimeSupervisor.spawn()` 抛 `PythonNotFoundError`；Renderer 显示 "Python not found" 诊断 | 在 UI 设置页提供手动配置 Python 路径入口（M1 scope 内仅诊断日志，Phase 2+ 加 UI） |
| **Runtime 端口绑定异常** | `127.0.0.1:0` 在虚拟网络/某些 VPN 下行为异常；端口被主动占用后 FastAPI 启动失败 | Runtime 尝试绑定 3 次（递增随机端口），均失败则退出并报告错误 | stdout 输出绑定失败信息；`runtime:error` 事件触发；Renderer 显示 "Runtime unavailable" | 重启 Runtime 进程（`RuntimeSupervisor.restart()`）；检查占用端口进程 |
| **Token 握手版本不匹配** | Desktop/Runtime/Protocol 三版本之一硬编码错误；token 截断（64→63 字符）或编码问题 | 契约测试覆盖三版本比对逻辑；token 生成用 `crypto.randomBytes(32).toString('hex')` 固定 64 字符 | `runtime.health` 返回 400/402 错误码；Electron 日志记录版本差异 | 修正版本常量重新构建；版本协商降级为严格相等（v1.0 只接受精确匹配） |
| **contextBridge/Preload 配置失误暴露 Node 能力** | `contextIsolation: false` 被意外设错；Preload 脚本被绕过或未加载；`nodeIntegration` 子页面设为 true | Security 测试断言 `window.require`/`exec`/`readFile`/`writeFile` 均 undefined 或抛错；CSP header 禁 `unsafe-eval` | `pnpm --filter @harness/desktop test` 安全测试失败 | 修正各配置具体字段；审查 Forge config + CSP 策略 |
| **CSP 策略允许远程脚本** | 默认 CSP 过松；第三方依赖注入 inline script；dev server 热更新开放了不该开的源 | `Content-Security-Policy` header 设为 `default-src 'self'; script-src 'self'`；security 测试验证无外部资源加载 | 打开 DevTools → Network 面板有外部请求；安全测试 CSP 违规断言 | 紧缩 CSP header；内联脚本改用 `<script>` + 文件引用 |
| **fixture 路径解析在 Windows 上错误** | `os.path.join` 反斜杠与 `/` 混用；`relative_to()` 在跨盘符路径上抛错；symlink/junction 逃逸未被检测 | 契约测试在 Windows 上跑参数化 fixture（含 Windows 特有路径 case）；Protocol loader 用 `pathlib.Path.resolve()` + `is_relative_to()` | `test_harness_v1_fixtures.py` 在 Windows CI 上失败 | 修正路径解析逻辑用 `pathlib` 标准库；严格拒绝非 `phases_root` 内 resolve 结果 |
| **TS 与 Python 类型不保持同步** | 手工维护两套类型（非代码生成）；JSON Schema 更新后一侧未跟 | 双方都从同一 `rpc.schema.json` 参考更新；双方测试覆盖相同示例 payload | `pnpm test`（TS 端）或 `pytest test_rpc_schema.py`（Python 端）任一失败 | 修正不同步侧的类型定义；引入 schema diff 脚本作为 CI 步骤 |
| **Python 3.13 行为差异** | FastAPI/Uvicorn/Pydantic 在 3.13 上有已知问题（新版本刚出时常见）；asyncio 行为变化 | CI 用 3.12 锁定版本作为基准；本地开发用 3.13；CI 双版本矩阵 | CI 中 3.12 通过但本地 3.13 失败 → 差异定位 | 降级 runtime/pyproject.toml 中 `requires` 上限为 `<3.13`（ADR-1 预设回滚）；装 3.12 继续开发 |
| **CI 配置在 GitHub Actions Windows runner 上不生效** | pnpm 安装命令不兼容 runner 的 PowerShell 默认环境；Python 安装脚本版本号不对；路径分隔符硬编码 | CI 先做 dry-run（只装工具链不做 task）；用 `shell: bash` 统一脚本解释器 | Push 后 CI 红（非测试失败，是环境配置失败） | 修正 CI YAML 中的安装命令；改为 `actions/setup-python@v5` + `pnpm/action-setup@v2` |
| **Git 初始化后忘记创建开发分支** | `git init` 后直接 commit 在 default branch（master/main），忘记 `git checkout -b codex/desktop-foundation` | Task 0.1 checklist 包含 git init + branch + commit 三步；commit 前检查 `git branch --show-current` | `git branch --show-current` 不是 `codex/desktop-foundation` | `git checkout -b codex/desktop-foundation` 并 cherry-pick 已有 commit |
| **`py -3` 提示 Python 未安装（Windows Store 重定向）** | Windows 10/11 的 app execution alias 优先级高于实际安装的 Python | `RuntimeSupervisor` 探测顺序：`py -3` → 常见路径（`C:\Python3*\python.exe`、`%LOCALAPPDATA%\Programs\Python\Python3*\python.exe`）→ 用户配置 | 探测失败日志记录所有候选路径 | 用户手动设置 Python 路径；禁用 app execution alias |

## 测试策略

- **契约测试**（Task 1.1-1.2）：参数化 fixture + 示例 payload → 覆盖有效/无效边界；是防止协议漂移的第一道防线。
- **安全测试**（Task 1.4）：`window.require`/`exec`/`readFile`/`writeFile` 不可用 + CSP 违规 → 防止安全壳破裂。
- **认证测试**（Task 1.3）：无 token/错误 token/版本不匹配被拒 → 防止未授权 Runtime 访问。
- **workspace 冒烟测试**（Task 0.1）：`pnpm install`/`typecheck`/`test`/`pytest` 全部退出码 0 → 防止环境配置错误。
- **CI 全量矩阵**（Task 0.2）：`lint` → `typecheck` → `pytest` + coverage → `vitest` → `build`；有意提交失败 fixture 验证 CI 阻断能力。

## 门禁预期

| Gate | 预计状态 | 条件 |
|---|---|---|
| G1_REQUIREMENTS | PASS ✓ | 验收标准可观察，人工确认已完成 |
| G2_DESIGN | 本轮评估（PASS） | 03+06 均产出后通过：受影响文件点名、回滚记录、验证命令列出 |
| G3_COMPILE | M1 目标 | `pnpm typecheck` + `python -m pytest` 退出码 0 |
| G4_UNIT_TEST | M1 目标 | Vitest + pytest 聚焦测试全部通过 |
| G5_ATDD | NOT_REQUIRED（M1 无集成场景） | N/A |
| G6_EVIDENCE | M1 目标 | 证据 JSON 含 changed_files/commands/gates/artifacts/waivers/residual_risks |
| G7_PRERELEASE | NOT_REQUIRED（M1 无安装包） | N/A |
| G8_ACCEPTANCE | M1 目标 | 验收报告总结范围/变更/验证/剩余风险 |

## 回滚预期

- **Python 版本**：3.13→3.12（ADR-1）
- **Electron 壳**：Reset 到 Forge 最小配置再逐步加
- **Protocol 问题**：fixture 基线回退到冻结哈希版本，不改合同
- **Workspace**：reset --hard + 重新 `pnpm install`
- **活动 Run**：本 Run 的 `required_nodes` 在创建时已冻结，`workflow.yaml` 修改不影响本 Run

## 停止条件

以下任一条件触发时停止推进，先修复再继续：

- `pnpm install` 在 Windows 上连续失败 3 次（不同网络/镜像）
- Python 子进程在 `RuntimeSupervisor` 探测所有候选路径后仍无法启动
- `pnpm typecheck` 或 `python -m pytest runtime/tests -q` 有未解释的非零退出码
- Security 测试中 `window.require` 或 `exec`/`readFile`/`writeFile` 任一未被阻止
- CSP 头部允许了 `unsafe-eval` 或远程源
- CI 环境配置（即使本地通过）在 Windows runner 上连续 2 次失败
- fixture 测试在 Windows 特有路径 case 上未覆盖或失败（路径穿越/junction/跨盘符）
