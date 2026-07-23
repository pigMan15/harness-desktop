# 验收报告

- Run：`desktop-functional-alignment-20260722`
- 意图/风险：`FEATURE / MEDIUM`
- 节点：`ACCEPTANCE_REPORT`
- 角色：orchestrator
- 验收范围：`01-requirement-review.md` 的 16 条标准，以及 `08-change-request.md` 已确认的同项目多 Run 并行增量
- 综合结论：建议 `PASS`

## 范围与交付

本次交付将桌面端主流程完善为显式项目选择、任务（Run）创建与生命周期管理、项目级线性 Workflow 编排、Run 绑定的 Gate/Artifact/Execution、真实 Codex `app-server --stdio` 协议接入，以及同一项目中多个 Run 的独立状态、revision、branch、worktree 和 execution session。已重新构建 Runtime，并生成全新的 Windows unpacked 桌面程序与 Squirrel 安装包，未复用 `out-fresh` 或旧 Runtime 产物。

## 验收标准结果

| # | 结果 | 验收结论与证据 |
|---:|:---:|---|
| 1 | PASS | 项目注册表以真实 `projectId` 解析路径，Renderer 的 WorkspaceContext 持久化所选项目；项目上下文与 API 隔离由 Runtime 项目测试、Renderer 测试和包内 Runtime 场景覆盖。 |
| 2 | PASS | 未选择项目时 Runs、Workflow、Gates、Execution 进入空状态并禁用依赖项目的动作，不回退使用进程 cwd；Renderer 与项目上下文测试通过。 |
| 3 | PASS | 创建任务要求合法 Run ID、Intent、Risk；Runtime 校验空值、非法路径字符和重复 ID。UI 已提供创建表单和错误提示。提示当前为页面级 notice，字段级定位可继续增强，但不影响错误可见性和创建约束。 |
| 4 | PASS | 创建后同时形成根兼容投影、`runs/<run-id>/state.json` 权威状态和 `phases/<run-id>/`，并立即进入 Run 列表；Run service 与持久化测试通过。 |
| 5 | PASS | Run 支持选择、暂停和恢复，状态持久化且 Dispatcher 路线不跳过 required node；Run service 与 Renderer 交互测试通过。 |
| 6 | PASS | Workflow 草稿保留 nodes、routes、hard rules、failure recovery 和 gate meanings，单路线编辑不会删除其余配置；round-trip 与 Workflow API 测试通过。 |
| 7 | PASS | Compile 使用当前草稿并返回节点、角色、Gate、路线和最低规则诊断，失败不写盘；包内 Runtime 场景读取 22 个节点并编译出 12 个 required nodes。 |
| 8 | PASS | Apply 前提供语义差异与确认，携带 expected hash；并发 hash 冲突拒绝覆盖。Workflow draft/API 测试覆盖冲突路径。 |
| 9 | PASS | 已存在 Run 的 `required_nodes` 保持冻结，新 Run 使用更新后的项目 Workflow；Run 与 Workflow 集成测试通过。 |
| 10 | PASS | Gate API 显式要求 `projectId + runId`，UI 展示并使用 selected Run；包内场景中 active Run 为 `packaged-parallel-b`、Gate 查询 Run 为 `packaged-parallel-a`，证明二者可安全不同。 |
| 11 | PASS | G3-G8 由 Runtime GateEngine 执行角色和确定性检查，普通 UI 请求不能直接覆盖状态；权限拒绝及 Run snapshot 一致性测试通过。 |
| 12 | PASS | Execution 先 probe Codex 并展示真实路径、版本和可用性；生产入口使用真实 app-server adapter，不显示 `Start (Fake)`。本机 WindowsApps Codex 路径无法由外部进程执行，因此被正确报告为 unavailable。 |
| 13 | PASS | Session 事件固定携带 session/project/run/sequence，SQLite 记录 worktree、branch、thread 和 turn；poll/respond/cancel 校验 Run 所有权，UI 切换 selected Run 不迁移旧 session。 |
| 14 | PASS | Codex 缺失、不可执行、启动失败和非零退出均返回明确诊断，不把节点或 Gate 标记成功；Codex adapter/API 测试和包内 probe 场景通过。 |
| 15 | PASS | 新包内 Runtime 场景完成项目导入、双 Run 创建/列出/选择、Workflow 获取与编译、显式 Run Gate/Artifact 查询和 Codex probe；unpacked 桌面 smoke 观察到 4 个 Electron 进程和 1 个 bundled Runtime 进程。Playwright 2 项通过，但当前主要覆盖 fixture/CSP 基础场景，跨层主流程证据以包内 Runtime 场景和桌面进程 smoke 为主。 |
| 16 | PASS | Runtime 214 项、Renderer 8 项、Desktop 7 项、Contracts 7 项测试通过；Python compileall、三套 TypeScript 类型检查和 Renderer production build 通过。clean Runtime 和全新 Windows 安装包均已生成并核对 hash。 |

## 多 Run 并行增量验收

| 增量标准 | 结果 | 证据 |
|---|:---:|---|
| 每个 Run 的权威 state、revision、retry counts、gates、phase_dir 独立 | PASS | `runs/<run_id>/state.json` 为权威来源，根 state 仅作 selected Run 兼容投影；陈旧根投影不能反向覆盖权威状态，相关持久化和 Run service 测试通过。 |
| Gate、Artifact、Execution 显式绑定 `projectId + runId` | PASS | API contract、Runtime API 与 Renderer 均显式传递 Run；跨 Run session 的 poll/respond/cancel 被拒绝。 |
| UI 切换 selected Run 不迁移已启动会话 | PASS | ExecutionPage 冻结 `sessionRunId`；Renderer 测试验证切换后旧 session 仍按原 Run 操作。 |
| 每个开发 Run 使用独立 branch/worktree | PASS | worktree manager 创建 `codex/<run_id>` 和独立目录；测试验证两个 worktree 可修改同名文件而不直接覆盖。非 Git 项目明确返回 `GIT_REPOSITORY_REQUIRED`。 |
| Runtime 重启后按原 Run 恢复或标记 session lost | PASS | recovery 数据包含 project、run、worktree、branch、thread、turn；恢复与失败隔离测试通过。 |

## 构建、测试与产物

- Runtime：`runtime/dist/harness-runtime.exe`
  - 大小：`20,605,604` 字节
  - SHA-256：`9E90B9E1FB8B4FFA971E58F2E91BD84C3C9C32FF76D8F315D292885F0BDFAD3B`
- Windows 安装包：`dist-functional-alignment-20260723/desktop-installer/Harness Desktop-0.0.0 Setup.exe`
  - 大小：`148,981,248` 字节
  - SHA-256：`46182289971F97B8A010CC40889A8EDE5ECD31C1154E24B0D590B3AC65878208`
- NuGet 包：`dist-functional-alignment-20260723/desktop-installer/harness-desktop-0.0.0-full.nupkg`
  - 大小：`148,184,827` 字节
  - SHA-256：`1A7ED816B03A79D9503FBFBD4DADEF13222CDBC9683132B437DA41C82C6A8FA5`
- nupkg 内嵌 Runtime 的 SHA-256 与本次 clean Runtime 完全一致。
- Forge 在线下载受子进程 PATH、沙箱网络 `EACCES` 和外部网络 `ECONNRESET` 影响，最终按仓库 README 的离线方案使用本地 Electron 31.7.7 zip、`electron-packager` 和 `electron-winstaller` 成功构建。

## 门禁汇总

- `G1_REQUIREMENTS`：PASS
- `G2_DESIGN`：PASS
- `G3_COMPILE`：PASS
- `G4_UNIT_TEST`：PASS
- `G5_ATDD`：NOT_REQUIRED（FEATURE/MEDIUM 路线不包含 ATDD；仍额外完成双 Run 和包内 Runtime 场景）
- `G6_EVIDENCE`：PASS
- `G7_PRERELEASE`：NOT_REQUIRED（当前路线不含预发布部署）
- `G8_ACCEPTANCE`：等待 verifier 复核，本报告不越权标记

## 剩余风险与非目标

1. 本机 Codex 位于受保护的 WindowsApps，桌面进程无权直接执行；Runtime 正确报告 unavailable。实际使用真实 Codex 前需要配置桌面进程可执行的 Codex CLI 路径。
2. 安装包未进行代码签名，Windows 可能显示未知发布者提示；签名属于已确认非目标。
3. 未在干净 Windows VM 执行安装、升级、卸载矩阵；该项属于已确认非目标，当前仅验证 unpacked 启动与 bundled Runtime。
4. Playwright 当前为系统 Edge 下的 2 项 fixture/CSP 基础场景，完整 UI 主流程自动化深度仍可增强；核心跨层行为已有包内 Runtime API 场景、Electron smoke 和聚焦单元/集成测试支撑。
5. FastAPI TestClient 存在 Starlette/httpx2 弃用警告，不影响当前结果，但后续依赖升级需要处理。

## 验收建议

16 条原始标准和多 Run 并行增量标准均有可观察实现与验证证据，clean Runtime 已嵌入新 Windows 安装包，已确认范围内无阻塞项。建议 verifier 将 `G8_ACCEPTANCE` 标记为 `PASS`，随后进入 `KNOWLEDGE_PROMOTION`。

## G8 独立复核

- 复核角色：verifier
- 复核结果：`PASS`
- 范围检查：已总结原始 16 条标准和已确认的多 Run 并行增量，满足要求。
- 验证检查：已汇总编译、类型检查、单元/集成测试、包内 Runtime 场景、桌面 smoke、构建产物与 hash，且失败尝试未被隐藏。
- 风险检查：已列出 Codex 主机权限、未签名、干净 VM 矩阵、Playwright 深度和依赖弃用警告。
- 结论：`18-acceptance-report.md` 满足 `.harness/evals/gates.yaml` 中 `G8_ACCEPTANCE` 的全部通过条件。
