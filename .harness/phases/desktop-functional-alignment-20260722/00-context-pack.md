# Context Pack

## 任务来源

- RunId: `desktop-functional-alignment-20260722`
- PRD 标识: Harness Desktop 最终架构方案
- PRD 路径或 Wiki 页面: `doc/desktop-architecture.md`、`doc/desktop-implementation-plan.md`
- 原型/截图: 当前已打包桌面程序及 Renderer 页面
- 发起人: 用户反馈
- 时间: 2026-07-22

## 需求摘要

当前桌面程序虽然展示了 Projects、Runs、Workflow、Gates 和 Execution 页面，但关键用户旅程没有形成可用闭环。用户无法可靠创建并切换任务/Run，Workflow Studio 的编辑、编译和应用语义不完整，Gates 未明确显示所属项目与 Run，Execution 仍使用 Fake Executor，不能探测和启动 Codex。除修复这些实现缺口外，本次还要审查原设计是否符合实际使用心智，并调整任务、Run、项目、工作流和执行器之间的产品关系。最终需要做到：先选择项目，再创建/切换任务 Run，再编辑面向未来 Run 的工作流，再在明确的当前 Run 上查看 Gates 和启动 Codex。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| `.harness` 是事实源 | 项目状态由 `.harness/state.json` 和 `runs/<run-id>/state.json` 决定，SQLite 只做可重建投影 | `doc/desktop-architecture.md` §3.1 |
| Run 路由冻结 | Workflow 修改只影响新 Run；活动 Run 迁移必须显式 CHANGE_REQUEST | `doc/desktop-architecture.md` §3.4 |
| 用户指定分类 | 创建 Run 时 Intent/Risk 必须由用户选择，不允许自动覆盖 | `doc/desktop-architecture.md` §5.3、`AGENTS.md` |
| Runtime 唯一写入口 | Renderer 和 Electron Main 不应直接写项目状态 | `doc/desktop-architecture.md` §8 |
| Codex 是首发执行器 | 首发应支持 probe/start/stream/respond/cancel/recover | `doc/desktop-architecture.md` §6.3、实施计划 Task 5.2 |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| case | 之前的对齐工作主要证明模块和测试存在，未证明打包应用的用户旅程可完成 | 当前用户反馈与已打包程序 |
| pitfall | 把 `projectId` 作为空壳参数会让所有页面悄悄操作 Runtime 启动目录，而不是用户选择的项目 | `runtime/src/harness_runtime/api/app.py` |
| pitfall | 前端显示“Create/Apply/Start”不等于后端有持久化、完整编译或真实执行 | Runs、Workflow、Execution 当前代码 |
| decision | v1 不引入新的项目协议；任务概念应由 UI 映射到 Run，并保留 `run_id`、Intent、Risk 的协议约束 | `doc/desktop-architecture.md` §3.1、§5.1 |

## 相关代码锚点

- 模块: `apps/renderer/src/features/projects`、`runs`、`workflow`、`gates`、`execution`
- Service: `runtime/src/harness_runtime/projects/service.py`、`runs/service.py`、`workflow/drafts.py`、`executors/codex/*`
- Controller/API: `runtime/src/harness_runtime/api/app.py`
- Desktop bridge: `apps/desktop/src/main/index.ts`、`apps/desktop/src/preload/index.ts`
- DTO/VO: `packages/contracts/src/rpc.ts`
- 配置: `.harness/workflow.yaml`、`runtime/src/harness_runtime/persistence/database.py`

## 当前证据与设计问题

1. Renderer 各页把 `projectId` 写死为 `local`，Runtime `_dispatch` 又忽略传入的 `projectId`，所有读写实际绑定进程级 `PROJECT_ROOT`。
2. `_run_create` 只返回 `create_run()` 生成的字典，没有写入 `.harness/state.json`、创建 phase 目录或保存 snapshot，因此 UI 创建后刷新看不到新 Run。
3. Runs 页面首次进入不自动加载，也没有切换、暂停、恢复动作；“任务”和“Run”的用户心智没有统一。
4. Workflow 的 Compile 调用编译的是磁盘旧 workflow，而不是前端草稿；随后 `buildYaml` 只输出单条 route，丢失其余 routes、hard rules、failure recovery 和 gate meanings，Apply 还传空 hash。
5. Gates 页面没有项目/Run 上下文，且 Runtime 直接覆盖 active state 的 gate 字段，未使用 GateEngine、角色权限、原子状态写入和 snapshot。
6. Execution 页面按钮明确为 `Start (Fake)`，Runtime 使用内存脚本事件；已有 CodexAdapter 没有接入 API 和 UI。
7. 项目导入只登记 SQLite，不会使后续业务 API 路由到该项目；项目列表也没有明确选择动作。
8. 设计文档以模块能力列表为主，缺少强制的端到端主路径和全局上下文模型，导致页面各自“看起来存在”但无法协同。

## 业务不变量

- 用户明确选择 Intent/Risk，软件不得自动改写。
- Workflow 修改默认只影响新 Run，不能静默改写活动 Run 的 `required_nodes`。
- 所有 `.harness` 状态写入必须经过 Runtime，并同步 active state 与 run snapshot。
- G3-G8 不能由普通用户界面绕过 verifier 权限直接标记 PASS。
- Codex 不可用时必须显示可操作诊断，不能自动退回 Fake 并伪装真实执行。
- 多项目操作必须由显式 projectId 解析到已注册路径，禁止继续依赖进程 cwd。

## 待确认问题

- v1 产品层将“任务”定义为一个 Run；UI 使用“任务”作为主称呼，并同时展示协议 Run ID，避免另造不受 `.harness` 管理的任务实体。
- 活动 Run 的 Workflow 迁移仍不在本次直接实现；页面明确“修改影响新任务”，活动 Run 只读展示冻结路线。
- Codex 首轮接入采用本机 Codex CLI 探测和子进程执行，不引入云端账号管理。

## 风险判断

- 建议 Intent: FEATURE（用户已确认）
- 建议 Risk: MEDIUM（用户已确认）
- 风险理由: 涉及 Renderer、Electron bridge、Runtime API、持久化和真实外部执行器，但不修改 `.harness` v1 协议，也不包含生产部署。

## 知识来源

- Obsidian: 无
- LLM Wiki: 无
- Harness run: `desktop-functional-alignment-20260722`
- 代码文件: 上述相关代码锚点
