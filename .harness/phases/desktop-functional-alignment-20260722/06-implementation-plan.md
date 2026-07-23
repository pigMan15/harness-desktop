# 实施计划

## 目标

按“项目 -> 任务 Run -> Workflow -> Gates -> Codex”主路径，将现有模块连接成可用桌面软件，并同时修正产品上下文、配置态/运行态边界和真实执行器协议。每个行为变化先有失败测试，再做最小实现，最后执行跨层和打包验证。

## 假设

- `.harness` v1 文件结构和当前 workflow/state schema 不变。
- Task 是 Run 的 UI 名称，不新增项目协议字段。
- SQLite registry 可增加派生数据和辅助查询，但项目 `.harness` 仍是事实源。
- Codex 使用独立安装或用户选择的 CLI；WindowsApps 内置路径可能不可从外部应用执行。
- 当前 CLI app-server 协议以 `codex app-server generate-json-schema --experimental` 生成结果为验证基准，并以宽容事件解析应对非关键字段新增。
- 工作区已有 README、打包产物和 harness 状态变更，不回退或混淆这些既有改动。

## 任务列表

### 任务 1：项目解析与多项目隔离

测试先行：

- 扩展 `runtime/tests/projects/test_project_service.py`：按 projectId 解析、未知 ID、目录丢失、重复导入。
- 新增 `runtime/tests/api/test_project_context.py`：两个 fixture 项目的 run/workflow 调用返回各自数据；缺 projectId 不回退 cwd。

实现文件：

- `runtime/src/harness_runtime/projects/service.py`：新增 get/resolve/update_active_run。
- `runtime/src/harness_runtime/api/app.py`：所有业务 dispatch 显式解析 projectId。
- `runtime/src/harness_runtime/persistence/database.py`：确认 registry schema/index 足够，不改变权威数据边界。

聚焦验证：

```powershell
python -m pytest runtime/tests/projects/test_project_service.py runtime/tests/api/test_project_context.py -q
```

### 任务 2：任务 Run 创建、切换、暂停和恢复

测试先行：

- 扩展 `runtime/tests/runs/test_run_service.py`：创建后三件套、重复 ID、路线冻结、switch/pause/resume、snapshot 一致性。
- 新增 API 测试：run.create/list/switch/pause/resume 使用真实 projectId 和 revision。

实现文件：

- `runtime/src/harness_runtime/runs/service.py`：增加持久化生命周期方法，复用 AtomicStateStore。
- `runtime/src/harness_runtime/api/app.py`：增加 run.switch/pause/resume，并返回 active/revision DTO。
- `runtime/src/harness_runtime/projects/service.py`：同步 registry active_run_id。

聚焦验证：

```powershell
python -m pytest runtime/tests/runs runtime/tests/api -q
```

### 任务 3：完整 Workflow 草稿预览与安全应用

测试先行：

- 扩展 `runtime/tests/workflow/test_drafts.py`：结构化 merge 保留未编辑 routes/hard_rules/failure_recovery/gate_meanings。
- 增加非法 role/gate/node、最低规则注入、hash 冲突和 active Run 路线冻结测试。
- 扩展 `apps/renderer/src/features/workflow-studio/useWorkflowDraft.test.ts`：加载、编辑、撤销、重做、route 选择和 preview 状态。

实现文件：

- `runtime/src/harness_runtime/workflow/drafts.py`：新增 build/preview structured draft 和版本记录。
- `runtime/src/harness_runtime/api/app.py`：workflow.get/preview/apply 使用项目上下文和 expected hash。
- `apps/renderer/src/features/workflow-studio/useWorkflowDraft.ts`
- `apps/renderer/src/features/workflow-studio/WorkflowCanvas.tsx`
- `apps/renderer/src/features/workflow-studio/NodeCatalog.tsx`
- `apps/renderer/src/features/workflow-studio/RouteEditor.tsx`
- `apps/renderer/src/features/workflow-studio/DiagnosticsPanel.tsx`
- `apps/renderer/src/features/workflow/WorkflowPage.tsx`

聚焦验证：

```powershell
python -m pytest runtime/tests/workflow -q
pnpm --filter @harness/renderer test -- useWorkflowDraft
```

### 任务 4：Gate 与 active Run 明确绑定

测试先行：

- 新增/扩展 Gate API 测试：两个 Run 状态隔离、caller role、G3-G8 权限、artifact 缺失、失败回退、snapshot 同步。
- Renderer 测试：页面显示项目/Run/Node/Role，任务切换后刷新，不提供任意状态覆盖按钮。

实现文件：

- `runtime/src/harness_runtime/gates/engine.py`：仅在必要时补充 API 适配所需结果信息。
- `runtime/src/harness_runtime/api/app.py`：gate.list/evaluate 读取 active state，调用 GateEngine 和 write_state。
- `apps/renderer/src/features/gates/GatesPage.tsx`

聚焦验证：

```powershell
python -m pytest runtime/tests/gates runtime/tests/api -q
pnpm --filter @harness/renderer test -- GatesPage
```

### 任务 5：Codex app-server 双向执行

测试先行：

- 重写 `runtime/tests/executors/codex/test_adapter.py`，使用 mock app-server 子进程验证 initialize/thread/start/turn/start。
- 覆盖 version/app-server probe、路径存在但不可执行、通知映射、命令/文件审批、respond、interrupt、异常退出和 sequence。
- 增加 API session 测试，证明 project/run/node/role 由 active state 决定。

实现文件：

- 新增 `runtime/src/harness_runtime/executors/codex/app_server.py`：JSON-RPC stdio、pending request、event queue、审批和关闭。
- `runtime/src/harness_runtime/executors/codex/adapter.py`
- `runtime/src/harness_runtime/executors/codex/process.py`
- `runtime/src/harness_runtime/executors/codex/events.py`
- `runtime/src/harness_runtime/api/app.py`：executor.probe/start/poll/respond/cancel。
- `runtime/src/harness_runtime/persistence/database.py`：复用 executor_sessions。

聚焦验证：

```powershell
python -m pytest runtime/tests/executors/codex runtime/tests/api -q
```

### 任务 6：Typed Desktop Bridge

测试先行：

- 扩展 `packages/contracts/tests/rpc.test.ts` 与 `apps/desktop/tests/security.test.ts`，检查新方法签名、projectId 透传和 allowlist。

实现文件：

- `packages/contracts/src/rpc.ts`
- `schemas/rpc.schema.json`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/index.ts`
- 新增 `apps/renderer/src/app/harness-api.d.ts`
- 从 `apps/renderer/src/app/App.tsx` 移除重复的 any 全局声明。

聚焦验证：

```powershell
pnpm --filter @harness/contracts test
pnpm --filter @harness/desktop test
```

### 任务 7：统一工作区界面与任务主路径

测试先行：

- 新增 WorkspaceContext、Projects、Runs、Execution 组件测试，mock typed preload API。
- 覆盖无项目空状态、选择持久化、创建错误、切换任务、Codex probe 不可用和审批响应。

实现文件：

- 新增 `apps/renderer/src/features/layout/WorkspaceContext.tsx`
- 新增共享样式 `apps/renderer/src/app/styles.css` 和必要的紧凑 UI 组件。
- `apps/renderer/src/app/App.tsx`
- `apps/renderer/src/features/layout/Sidebar.tsx`
- `apps/renderer/src/features/projects/ProjectsPage.tsx`
- `apps/renderer/src/features/runs/RunsPage.tsx`
- `apps/renderer/src/features/execution/ExecutionPage.tsx`
- `apps/renderer/src/features/artifacts/ArtifactsPage.tsx`
- `apps/renderer/src/features/recovery/RecoveryPage.tsx`
- `apps/renderer/src/features/knowledge/KnowledgePage.tsx`

实现要求：

- 所有页面使用 selectedProjectId，不出现硬编码 `local`。
- 顶部固定展示当前项目和活动任务。
- Runs 首次进入自动加载；创建、切换、暂停、恢复有加载/错误/成功状态。
- Execution 展示真实 Codex capability，不显示 Fake 默认入口。
- 使用一致图标、工具提示、密集但清晰的工作台布局；桌面和窄窗口文字不重叠。

聚焦验证：

```powershell
pnpm --filter @harness/renderer test
pnpm --filter @harness/renderer typecheck
```

### 任务 8：跨层主路径和功能设计复核

- 扩展 `tests/e2e/project-import.spec.ts` 或新增主路径 spec：选择项目 -> 创建任务 -> 切换任务 -> 预览 Workflow -> 查看 active Run Gates -> probe Codex。
- 对照 `01-requirement-review.md` 16 条标准逐项记录证据。
- 检查所有可见页面是否仍有隐式项目/Run、演示数据、不可操作按钮、误导文案或越权状态操作。

验证命令：

```powershell
rg -n "'local'|\"local\"|Start \(Fake\)|PROJECT_ROOT" apps runtime
python -m pytest runtime/tests -q
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

### 任务 9：重新构建 Runtime 与桌面安装包

- 用 PyInstaller `--clean` 从本次源码重新构建 `harness-runtime.exe`。
- 将新 Runtime 复制到 desktop resources。
- 从干净输出目录打包 Electron unpacked app 和 Windows installer。
- 核对安装包内 Runtime size/hash 与本次构建一致。
- 运行 unpacked app 主路径冒烟并记录截图/日志；不把旧 `apps/desktop/out-fresh` 当作新产物。

验证命令：

```powershell
python -m PyInstaller runtime/harness-runtime.spec --clean --noconfirm
pnpm --filter @harness/desktop package
```

若 Forge 网络步骤仍出现 ECONNRESET，使用仓库 README 已记录的 local Electron dist + electron-packager + electron-winstaller 路径，但必须使用本次重新构建 Runtime 和新的输出目录。

## 验证计划

1. 每个任务先运行聚焦测试确认失败，再实现并转绿，结果写入 `11-development.md`。
2. Runtime 全量：`python -m pytest runtime/tests -q`。
3. TypeScript：`pnpm typecheck`、`pnpm test`。
4. 跨层：`pnpm test:e2e`，必要时增加 Electron/HTTP 场景脚本。
5. 构建：`pnpm build`。
6. 打包：PyInstaller clean build + Electron package；计算 SHA-256。
7. 完成审计：逐条映射 16 条验收标准到测试、文件、截图或产物。

## TDD 记录

- 新增或选中的测试：项目隔离、Run 持久化、Workflow round-trip、Gate 权限、Codex app-server、WorkspaceContext 和桌面主路径。
- 初始失败：在 DEVELOPMENT 中按任务逐项记录，必须证明失败来自预期缺口。
- 实现：只在对应失败测试建立后修改业务代码。
- 聚焦结果：每个任务完成时记录命令和退出码。
- 扩展结果：在 COMPILE/UNIT_TEST/EVIDENCE 节点记录全量结果。

## 回滚计划

- 每个纵向任务保持独立可审查改动，不触碰已有 README/打包历史变更。
- Runtime 状态变更只经 AtomicStateStore；测试使用临时 fixture，不在当前真实 run 上执行破坏性场景。
- Workflow apply 测试保留旧内容/hash 并在 fixture 中验证恢复。
- Codex 集成以 feature availability 控制；发生协议不兼容时禁用入口，不影响项目/Run/Workflow。
- 打包使用新的 dist 子目录；旧安装包不覆盖，直到新主路径 smoke 通过。

## G2 评估

- 结果：PASS
- 依据：方案点名了跨层模块、数据流、兼容性、失败预演和回滚；计划逐项列出确切文件、TDD 顺序、验证命令和打包检查。

## 变更请求增量计划：同项目多 Run 并行

### 增量任务 A：Run 权威状态与 Run 级锁

- 新增失败测试：两个 Run 使用不同 revision 并发写入；一个 Run 的 stale revision 不影响另一个 Run；根投影变化不覆盖 Run 权威状态。
- 实现 `read_run_state/write_run_state/project_run_state`，锁文件位于 `runs/<run_id>/.lock`。
- 重构 create/list/switch/pause/resume 使用 Run 权威文件，根 state 只作 selected Run 兼容投影。

### 增量任务 B：worktree 生命周期

- 新增临时 Git 仓库测试：创建两个 Run 生成不同 `codex/<run_id>` branch 和 worktree；两个 worktree 修改同名文件互不覆盖。
- 新增 worktree manager，校验 Git 根、分支名、路径包含关系和已存在 worktree；非 Git 项目返回明确 capability。
- Run 状态记录 `branch_name/worktree_path/worktree_status`，Execution 只使用固定 worktree cwd。

### 增量任务 C：Run 显式业务 API

- Gate、Artifact、Execution API 测试全部传 `projectId + runId`，并创建两个 Run 验证隔离。
- Gate revision、phase_dir 和 retry 回退只写目标 Run。
- Execution session 创建时固定 runId/worktree；切换 registry active_run_id 后 poll/respond/cancel 仍命中原 session。
- Desktop bridge 与 Renderer API 增加 runId；selected Run 仅为调用默认值。

### 增量任务 D：恢复与验收

- executor_sessions 增加 worktree_path/thread_id/turn_id 或等价可恢复元数据迁移。
- Recovery scan 按 project/run/worktree 输出，不自动完成节点或删除 worktree。
- 双 Run 场景：同时 start、交错 poll、分别 Gate、分别读取 Artifact、切换 UI selection，证明事件和状态不串线。

### 增量验证

```powershell
python -m pytest runtime/tests/persistence runtime/tests/runs runtime/tests/api -q
python -m pytest runtime/tests/executors runtime/tests/recovery -q
node_modules\.bin\tsc.cmd --noEmit -p apps\renderer\tsconfig.json
node_modules\.bin\tsc.cmd --noEmit -p apps\desktop\tsconfig.json
```

原任务 9 的 clean Runtime/桌面打包保持不变，但必须在上述双 Run 验收通过后执行。
