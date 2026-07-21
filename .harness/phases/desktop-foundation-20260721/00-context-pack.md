# Context Pack — Harness Desktop Foundation

保存位置：`.harness/phases/desktop-foundation-20260721/00-context-pack.md`

## 任务来源

- RunId: `desktop-foundation-20260721`
- PRD 标识: 架构方案 + 实施计划（双文档）
- PRD 路径或 Wiki 页面: `doc/desktop-architecture.md`、`doc/desktop-implementation-plan.md`
- 原型/截图: 无（首发为骨架，无视觉原型）
- 发起人: 用户
- 时间: 2026-07-21

## 需求摘要

构建 **Harness Desktop**——Windows 首发、严格兼容 `.harness` v1.0、可驱动 Codex 的 AI Coding 流程治理桌面应用。它把 `.harness` 中靠文件与 Agent 指令执行的约束，转化为可观察、可审批、可恢复、可审计的桌面工作台。三层架构：React Renderer（只通过类型化 Preload API 访问业务能力）+ Electron Main（OS 能力与 Runtime 生命周期）+ Python Runtime（`.harness` 唯一写入入口）。本 Run **只交付里程碑 M1**：安全 Electron 壳可启动认证 Python Runtime（实施计划 Phase 0 + Phase 1）。验收方向：空工作区命令全退出码 0、契约 fixture 分类正确、认证握手拒绝非法 token、Renderer 无 Node/Shell 权限。

## 相关业务知识

从架构方案与实施计划中检索到的关键事实。

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| 22 内置节点 | INTAKE→…→KNOWLEDGE_PROMOTION 线性目录，每个节点绑定默认角色与产物 | 架构 §5.2 |
| State 关键约束 | run_id 正则 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`；Intent/Risk 枚举；phase_dir 必须解析后仍在 phases 根；required/completed 取交集计进度；Gate 状态枚举；retry 上限 2 | 架构 §5.1 |
| 系统最低规则 | 代码变更必含 COMPILE/UNIT_TEST/EVIDENCE_CAPTURE；HIGH 必含四个确认+PRE_MORTEM；HIGH/DEPLOYMENT 必含 PRERELEASE+INTERFACE；intent/risk 只能用户指定；G3-G8 只能 verifier 写 | 架构 §5.3 |
| Gate 确定性语义 | required artifact 须存在/普通文件/非空；路径不得越界；state 标 PASS 但确定性检查失败→FAIL；G6 Evidence 九字段；WAIVED 须 scope/reason/owner/时间 | 架构 §5.4 |
| 三层边界 | Renderer 不直接访问 Node/Shell/SQLite/项目文件；写入经 Runtime command + expected_revision；Preload 不暴露通用 exec/readFile/writeFile | 架构 §8.2/§8.1 |
| 活动 Run 路由冻结 | 创建 Run 时编译路由写入 required_nodes；改 workflow.yaml 只影响新 Run；迁移活动 Run 走 CHANGE_REQUEST | 架构 §3.4 |
| 安全模型 | contextIsolation=true、nodeIntegration=false、sandbox；CSP 禁任意/远程脚本；Renderer 不持 token；路径 canonicalize + 拒 symlink/junction；白名单；secret 入 Keychain；日志脱敏；token 短时/loopback/握手失败退出 | 架构 §14 |
| 数据归属 | 当前 Run 状态/阶段产物/Workflow=项目权威不可重建；项目注册/Workflow 历史/审计/UI 缓存=AppData 可重建；API Key=Keychain 不可重建 | 架构 §13 |
| v1 线性限制 | 首发只支持有序线性 routes；DAG/并行/循环/动态分支/多 Agent 属 v2，不得静默写 v2 格式 | 架构 §3.3/§21 |

## 相关历史经验

本仓库 `.harness` 即 harness 项目自身（bridle CLI v0.1.0）的治理记录，与本次开发高度相关。

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| case | bridle v0.1.0 已用 PyInstaller 打包为 `bridle.exe` 单文件二进制并发布 GitHub Release——验证了 Python+PyInstaller 打包路径在本机可行 | run `release-v0.1.0-20260719` |
| case | harness-tui 用 Textual+Rich 实现 TUI；本次 Desktop 改用 Electron+React，但 Runtime 仍为 Python，复用 Python 工程经验 | run `harness-tui-20260719` |
| decision | harness 项目协议保持 v1.0 不重写，Desktop 通过协议兼容而非源码复用——独立实现 Protocol Adapter | 架构 §3.2 |
| pitfall | Windows 下 Git Bash 的 `python3`/`python` 被 app execution alias 拦截，需用 `py -3` 或全路径；CI/脚本须显式指定解释器 | 本 Run INTAKE 实测 |
| pitfall | `bridle save` 会给快照重打 `last_updated` 时间戳，非纯拷贝；保证审计镜像一致需手动 `cp` 覆盖 | 本 Run INTAKE 实测 |

## 相关代码锚点

本 Run 为**全新仓库**（当前仅 `.harness`/`doc`/`AGENTS.md`/`CLAUDE.md`/`README*`/`LICENSE`），无既有源码。锚点是**必须遵循的协议源**与**待创建的目录骨架**。

- 协议源（只读对照）:
  - `.harness/state.json` / `.harness/state.schema.json` — State 契约
  - `.harness/workflow.yaml` — 22 节点、routes、hard_rules、failure_recovery
  - `.harness/evals/gates.yaml` — G1-G8 描述与产物要求
  - `.harness/agents/*.md` — 角色职责（Runtime 不依赖，但 fixture 须覆盖）
- 待创建目录骨架（实施计划 §2）:
  - `apps/desktop/{src/main,src/preload,tests}` — Electron
  - `apps/renderer/{src/app,src/features,src/components,tests}` — React
  - `runtime/{pyproject.toml,src/harness_runtime/{api,contracts,protocol,workflow,runs,gates,artifacts,executors,approvals,persistence,recovery},tests}` — Python Runtime
  - `packages/contracts` — 共享 TS 契约
  - `schemas/`、`fixtures/harness-v1/`、`tests/e2e/`

## 业务不变量

本次实现不得破坏以下规则。

- 项目 `.harness` v1.0 协议不得重写：不引入 `project.yaml`/`events/<run>.jsonl`；`state.json`/`phase_dir`/`runs/<id>/state.json` 权威边界不可越界。
- Runtime 是项目状态唯一写入入口；Renderer/Electron 不得绕过 Runtime 直接改权威状态。
- Preload 只暴露类型化业务 API，不暴露 `exec`/`readFile`/`writeFile`；Renderer 无 Node/Shell 权限。
- `contextIsolation=true`、`nodeIntegration=false`、sandbox；CSP 禁任意/远程脚本；Renderer 不持 Runtime token。
- 路径 canonicalize 后验证仍在授权根；拒绝 symlink/junction 逃逸；id/文件名白名单。
- intent/risk 只能由用户指定，Runtime 与执行器不得覆盖。
- G3-G8 只能 verifier 权限域写入；Developer 不得标 COMPILE PASS。
- 系统最低规则不可删除（`effective_rules = system_minimum ∪ project_hard`）。
- 首发只表达 v1 线性路由；不得静默写 v2 格式。

## 待确认问题

需在 REQUIREMENT_REVIEW 或 SOLUTION_DESIGN 阶段定夺。

- **Python 解释器版本**：实施计划 Task 0.1 要求 `>=3.11,<3.13`，本机仅 Python 3.13.6。决策选项：(a) 放宽 Runtime 上限到 3.13 并同步 `pyproject.toml` 与 CI；(b) 安装 3.11/3.12 专用解释器（影响 PyInstaller 打包与 CI runner）。**阻塞 DEVELOPMENT，须 SOLUTION_DESIGN 前定。**
- **Git 仓库与远端**：当前环境非 git 仓库。Task 0.1 需 `git init` + 分支 `codex/desktop-foundation`。是否已有目标远端（GitHub repo）？CI（Task 0.2）需远端触发。若无远端，CI 部分只能本地验证，Task 0.2 降级。
- **Fixture 来源与哈希审计**：架构 §17 要求从已发布 Harness 模板复制 fixture 并 CI 审核版本/哈希，不依赖相邻 `harness-main`。M1 是否以本仓库 `.harness/` 作为初始 fixture 基线（并记录其哈希），还是从外部已发布模板获取？需在 Task 1.1 前明确 provenance。
- **Codex 可用性**：架构首发执行器为 Codex。M1 不集成 Codex（属 Phase 4），但 Task 1.3/1.4 的 Runtime 握手与 Electron 壳须为后续 Codex Adapter 预留 Executor 接口。确认 M1 不依赖真实 Codex（用 Fake/空实现）。
- **签名凭证**：M1 不打包安装包（属 Phase 6），但 CI 若无签名凭证只能产 unsigned artifact，不得宣称发布通过。确认 M1 不涉及签名。

## 风险判断

- 建议 Intent: FEATURE（已由用户指定，与本分析一致——构建全新应用）
- 建议 Risk: HIGH（已由用户指定，与本分析一致——安全敏感面广、规模大、多确认门禁）
- 风险理由: Desktop 处理 `.harness` 权威状态、OS Keychain、Codex 子进程与路径安全；架构 §14 列大量安全约束；首发跨 Electron/React/Python 三栈且需协议兼容防漂移。故 HIGH 的额外确认节点（REQUIREMENT_CONFIRMATION/SOLUTION_CONFIRMATION/PRE_MORTEM/ACCEPTANCE_CONFIRMATION）与预发布/接口测试是合理保险。**注：intent/risk 已由用户在 `bridle new` 时指定，本处仅作一致性记录，不覆盖。**

## 知识来源

- 架构方案: `doc/desktop-architecture.md`（最终方案 2026-07-21，§1-§21）
- 实施计划: `doc/desktop-implementation-plan.md`（Phase 0-7、§3 里程碑、§4 回滚、§5 自检）
- Harness run: `release-v0.1.0-20260719`（PyInstaller 打包经验）、`harness-tui-20260719`（Python 工程经验）
- 代码文件: `.harness/state.schema.json`、`.harness/workflow.yaml`、`.harness/evals/gates.yaml`、`.harness/agents/*.md`
- CLI: `bridle v0.1.0`（`bridle new/status/save/gates` 实测可用）

## 下一步

进入 **REQUIREMENT_REVIEW**（requirement-analyst）：基于本 context pack 产出 `01-requirement-review.md`，把目标/范围/非目标/验收标准/开放问题/风险正式化为可观察的验收清单（按 `.harness/context/acceptance.md` 的“给定 X，当 Y，应得 Z”范式），供 G1_REQUIREMENTS 门禁评估。
