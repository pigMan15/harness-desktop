<p align="center">
  <a href="README.md">中文</a> &nbsp;|&nbsp;
  <a href="README_en.md">English</a>
</p>

# Harness Desktop

> 将 `.harness` 工程化约束变成可观察、可审批、可恢复、可审计的 AI Coding 桌面工作台。

**当前版本：0.2.1** · Windows 首发 · Electron + React + Python Runtime · 原生 Codex Terminal

Harness Desktop 面向需要长期使用 AI Coding Agent 的项目。它不替代 Codex，也不把流程约束藏在 Prompt 里，而是把项目规则、Run、Worktree、节点、门禁、产物、审批和知识沉淀放到一个可视化工作台中。

`.harness/` 始终是工程状态的唯一事实来源；Desktop 的 SQLite 数据只是可以重建的本地投影。

## 为什么需要 Harness Desktop

普通 AI Coding 会话容易出现以下问题：

- Agent 看不到或没有遵循项目规范。
- 多个任务直接修改同一个工作区，差异相互污染。
- 任务执行完成了，但外部流程状态、门禁和产物没有同步。
- 高风险命令、文件写入和 Git 操作缺少人工审批。
- 会话中断后无法判断哪些进程、终端和 Run 仍可恢复。
- 项目经验停留在聊天记录中，无法沉淀到共享知识库。

Harness Desktop 将这些问题映射为显式、可追踪的工程对象。

## 核心能力

| 模块 | 当前能力 |
| --- | --- |
| **Projects** | 导入已有 `.harness` 项目；为普通 Git 项目初始化或补齐 `.harness`、`AGENTS.md`、`CLAUDE.md`；合并已有根说明并自动 Git stage，不自动 commit。 |
| **Runs** | 创建、切换、暂停、恢复和归档 Run；保留用户指定的 Intent/Risk；每个开发 Run 使用独立 Git branch/worktree。 |
| **Merge Back** | 在界面中将 Run 分支合并回当前项目分支；要求目标工作区和 Run worktree 干净，并使用 fast-forward 安全策略。 |
| **Terminal** | 每个 Run 独立的 Codex/Shell PTY；支持 ANSI、中文、复制粘贴、搜索、resize、scrollback、Ctrl+C、停止和重启。 |
| **Workflow** | 可视化查看与编辑节点、角色、Artifact、Gate、路由、失败恢复和 YAML；支持导入、导出、语义 Diff 与版本恢复。 |
| **Gates** | 显示 G1-G8 状态；G3-G8 仅 verifier 可判定；支持结构化 waiver、retry 和 BLOCKED 路由。 |
| **Artifacts** | 从当前 Run/Worktree 安全读取阶段产物；Markdown 渲染、文本预览和文件哈希。 |
| **Knowledge** | 卡片化审核知识候选；对接共享 Git 知识库；Codex 中文合成、Diff 预览、多审批队列、人工反馈、应用内推送及“已推送 ×N”标记。 |
| **Recovery** | 进入页面自动扫描可恢复的 Codex/Terminal 会话；支持手动刷新、查看、停止和清理孤儿状态。 |
| **Settings** | 自动发现或手动选择 Codex CLI；保存可执行文件路径，不保存 Codex 登录 Token。 |

## 典型工作流

```text
导入项目
  ↓
初始化/修复 Harness 文件并 Git stage
  ↓
创建 Run（Intent + Risk）
  ↓
为开发任务创建独立 branch/worktree
  ↓
在 Terminal 中运行 Codex，生成当前节点产物
  ↓
显式完成节点 → Runtime 校验 revision / artifact / gate
  ↓
完成后将 Run 安全合并回项目分支
  ↓
审核知识候选 → Codex 更新共享知识库 → Preview Diff → Push
```

终端进程退出不会自动推进 Harness 节点。只有显式完成/确认操作通过 Runtime 校验后，Dispatcher 才会进入下一节点。

## Git Worktree 与合并

需要 DEVELOPMENT 的 Run 会获得独立目录：

```text
.<repository>-harness-worktrees/<run-id>/
```

创建 worktree 时会同步项目的 `.harness/`、`AGENTS.md` 和 `CLAUDE.md`，确保 worktree 中启动的 Codex 仍遵循同一套规范。

Merge Back 的保护规则：

- 目标项目工作区必须干净，否则返回 `TARGET_WORKTREE_DIRTY`。
- Run worktree 必须干净，否则返回 `RUN_WORKTREE_DIRTY`。
- detached HEAD、缺失分支或缺失 worktree 会被拒绝。
- 默认只允许 fast-forward；分支分叉时需要先在 Run 分支完成 rebase/冲突处理。
- 合并使用 Git 操作，不通过文件复制覆盖项目。

## 共享知识库

Knowledge 模块支持把已审批记录沉淀到独立 Git 仓库：

1. 配置 Local Path、Remote URL 和 Branch；选择本地 Git 仓库时会自动读取 remote。
2. Pull/Clone 共享知识库。
3. 在 Accepted 列表中勾选一个或多个候选记录。
4. 运行 Codex Synthesis。Codex 会先读取知识库自身的规则、模板和目录结构。
5. 在右侧查看中文执行日志、审批请求和本地 Git Diff。
6. 使用人工反馈要求 Codex 继续修改，或确认结果。
7. 通过应用提交并推送，或者复制命令自行使用 Git。

通过 **Push via App** 成功推送后，候选卡片显示 `已推送`；重复沉淀显示 `已推送 ×N`。记录仍保持 Accepted，可以再次选择和更新。

Knowledge 页面采用自适应布局：空闲时候选列表全宽展示；运行 Codex 或生成 Diff 后自动展开右侧执行工作台。

## 架构

```text
┌──────────────── React Renderer ────────────────┐
│ Projects · Runs · Terminal · Workflow · Gates │
│ Artifacts · Knowledge · Recovery · Settings   │
└──────────────────────┬─────────────────────────┘
                       │ contextBridge 类型化 API
┌──────────────── Electron Main ─────────────────┐
│ Runtime Supervisor · IPC · Dialog · node-pty  │
└──────────────────────┬─────────────────────────┘
                       │ 127.0.0.1 + 一次性 Token
┌──────────────── Python Runtime ────────────────┐
│ Protocol · State · Runs · Gates · Executor    │
│ Artifacts · Recovery · Knowledge · SQLite     │
└──────────────────────┬─────────────────────────┘
                       │
                 项目 .harness/
```

- Renderer 开启 `contextIsolation`，不能直接访问 Node、Shell 或文件系统。
- Electron Main 负责操作系统能力、PTY 和 Runtime 生命周期，不直接实现 Harness 业务状态机。
- Python Runtime 是 Harness 状态的统一写入口，负责路径校验、锁、revision、原子写入和快照。
- 打包版本使用内置 `harness-runtime.exe`；开发版本由 Electron 自动启动 `py -3 -m harness_runtime.main`。

## 安装

### 使用安装包

从 [GitHub Releases](https://github.com/pigMan15/harness-desktop/releases) 下载 Harness Desktop 0.2.1 的 Windows 安装包。

当前安装包未提供正式代码签名，Windows 可能显示未知发布者提示。生产分发前仍需要独立完成签名、升级和卸载验证。

### 源码开发

环境要求：

- Windows 10/11
- Node.js 18+
- pnpm 8+
- Python 3.11+
- Git
- Codex CLI（使用 Terminal/Knowledge Codex 时需要）

```powershell
# 安装前端和 Electron 依赖
pnpm install

# 安装 Python Runtime
py -3 -m pip install -e "runtime[dev]"

# Electron 会自动启动并认证 Runtime
pnpm --filter @harness/desktop dev
```

如果 Electron 安装不完整：

```powershell
pnpm install --force
```

仍然失败时，删除损坏的 `node_modules/electron` 对应 pnpm 包目录后重新安装。详见 [故障排查](docs/troubleshooting.md)。

## 验证

```powershell
# TypeScript
pnpm typecheck
pnpm test

# Python Runtime
py -3 -m pytest runtime/tests -q

# E2E
pnpm test:e2e
```

仓库包含 Runtime 单元测试、协议契约测试、安全测试、并行终端测试和 Playwright 场景。测试数量会随功能变化，因此 README 不固定声明某个总数。

## 打包

推荐使用仓库脚本：

```powershell
.\scripts\package-runtime.ps1
.\scripts\package-desktop.ps1
```

或运行 Electron Forge：

```powershell
pnpm --filter @harness/desktop package
```

预期 Windows 产物包括：

- `Harness Desktop-0.2.1 Setup.exe`
- `harness-desktop-0.2.1-full.nupkg`
- `RELEASES`
- unpacked `Harness Desktop.exe`

不要把新的打包输出放在 `apps/desktop` 源码目录内部，避免旧 `out/` 被再次打入 `app.asar`。网络下载失败、本地 Electron fallback 和 Runtime 重新打包步骤见 [docs/troubleshooting.md](docs/troubleshooting.md)。

## 项目结构

```text
harness-desktop/
├─ apps/
│  ├─ desktop/             Electron Main、Preload、PTY、Runtime Supervisor
│  └─ renderer/            React 页面、Workflow、Terminal、Knowledge UI
├─ runtime/
│  ├─ src/harness_runtime/ Python Runtime 业务模块
│  └─ tests/               Runtime 与协议测试
├─ packages/contracts/     共享 TypeScript 契约
├─ schemas/                冻结的 state/RPC Schema
├─ fixtures/harness-v1/    有效与无效协议 Fixture
├─ scripts/                Runtime/Desktop 打包脚本
├─ docs/                   用户与故障排查文档
└─ .harness/               本项目自己的 Harness 事实来源
```

## 安全边界

- Runtime 只监听 `127.0.0.1`，使用 Electron 生成的一次性 Token。
- Renderer 禁止直接调用 Shell 和文件系统。
- 项目路径、Artifact 路径和 ZIP 内容经过规范化与越界检查。
- Codex 审批按 command/file/network/deploy/delete/permission/git 等类别处理。
- 不允许以通用 shell/python 前缀作为永久授权规则。
- Codex 登录凭据由 Codex CLI 管理，Harness Desktop 不保存账号 Token。
- 诊断输出对敏感字段进行脱敏。

## 当前边界

- Windows 是当前主要支持平台。
- 安装包代码签名、自动更新和干净 VM 的安装/升级/卸载仍需发布级验证。
- 软件外手动 Git push 不会自动更新 Knowledge 卡片的“已推送”次数。
- Workflow 当前围绕 `.harness` v1.0 的线性路由与门禁模型，不是通用 DAG 编排器。

## 文档

- [用户指南](docs/user-guide.md)
- [Workflow Studio](docs/workflow-studio.md)
- [故障排查](docs/troubleshooting.md)
- [桌面架构](doc/desktop-architecture.md)
- [实施计划](doc/desktop-implementation-plan.md)
- [变更日志](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 pigMan
