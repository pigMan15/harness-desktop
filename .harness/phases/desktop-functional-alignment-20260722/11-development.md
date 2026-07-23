# 开发记录

- Run：`desktop-functional-alignment-20260722`
- 意图/风险：`FEATURE / MEDIUM`
- 节点：`DEVELOPMENT`
- 变更依据：`01-requirement-review.md`、`03-solution-design.md`、`06-implementation-plan.md`、`07-acceptance-confirmation.md`、`08-change-request.md`

## 实现结果

1. 项目上下文
   - 所有业务 API 通过项目注册表中的真实 `projectId` 解析目录；解析失败不回退到进程 cwd。
   - Renderer 增加持久化项目选择和统一 WorkspaceContext；未选择项目时业务页面进入空状态。
2. 任务与 Workflow
   - 支持 Run 创建、列表、选择、暂停和恢复；新 Run 冻结创建时的 `required_nodes`。
   - Workflow 支持结构化预览、诊断、语义 diff、expected hash 冲突检查和安全 apply；保留未编辑配置。
3. Gate、Artifact 与 Codex
   - Gate 由 Runtime GateEngine 确定结果和权限，G3-G8 不能由普通 UI 请求直接写状态。
   - Artifact 访问限定在指定 Run 的 phase_dir。
   - Codex 使用真实 `codex app-server --stdio`，覆盖 initialize、thread/start、turn/start、事件轮询、审批响应、中断和退出状态。
4. 多 Run 并行增量
   - `.harness/runs/<run_id>/state.json` 成为每个 Run 的权威状态和 revision 来源；根 `.harness/state.json` 仅为选中 Run 的兼容投影。
   - 每个 Run 使用 `runs/<run_id>/.lock` 独立写入；A 的 stale revision 不阻塞 B。
   - Run、Gate、Artifact、Execution API 显式绑定 `projectId + runId`；变更操作使用目标 Run 的 `expectedRevision`。
   - 开发节点执行前创建或复用 `codex/<run_id>` 分支及独立 Git worktree；非 Git 项目返回 `GIT_REPOSITORY_REQUIRED`。
   - Execution session 在 SQLite 中固定保存 project、run、worktree、branch、thread 和 turn；poll/respond/cancel 校验 project/run 归属。
   - Renderer 启动 session 后冻结 `sessionRunId`，切换选中 Run 不会迁移已有会话。
   - Recovery 按 project 扫描并展示 Run、node、branch、worktree、thread 和 turn 元数据。
5. Windows 稳定性
   - ProjectLock 和 Recovery 的 PID 探测在 Windows 改用 `OpenProcess`，避免 `os.kill(pid, 0)` 导致测试或 Runtime 进程退出。

## 主要变更文件

- Runtime：
  - `runtime/src/harness_runtime/api/app.py`
  - `runtime/src/harness_runtime/projects/service.py`
  - `runtime/src/harness_runtime/runs/service.py`
  - `runtime/src/harness_runtime/runs/worktrees.py`
  - `runtime/src/harness_runtime/persistence/state_store.py`
  - `runtime/src/harness_runtime/persistence/project_lock.py`
  - `runtime/src/harness_runtime/persistence/database.py`
  - `runtime/src/harness_runtime/persistence/migrations/001_initial.sql`
  - `runtime/src/harness_runtime/workflow/drafts.py`
  - `runtime/src/harness_runtime/executors/codex/adapter.py`
  - `runtime/src/harness_runtime/executors/codex/app_server.py`
  - `runtime/src/harness_runtime/recovery/service.py`
- Desktop/Contracts：
  - `packages/contracts/src/rpc.ts`
  - `apps/desktop/src/main/index.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/preload/harness-api.ts`
- Renderer：
  - `apps/renderer/src/app/harness-api.d.ts`
  - `apps/renderer/src/app/App.tsx`
  - `apps/renderer/src/app/styles.css`
  - `apps/renderer/src/features/layout/WorkspaceContext.tsx`
  - `apps/renderer/src/features/projects/ProjectsPage.tsx`
  - `apps/renderer/src/features/runs/RunsPage.tsx`
  - `apps/renderer/src/features/workflow/WorkflowPage.tsx`
  - `apps/renderer/src/features/workflow-studio/*`
  - `apps/renderer/src/features/gates/GatesPage.tsx`
  - `apps/renderer/src/features/artifacts/ArtifactsPage.tsx`
  - `apps/renderer/src/features/execution/ExecutionPage.tsx`
  - `apps/renderer/src/features/recovery/RecoveryPage.tsx`
- 新增/扩展测试：
  - `runtime/tests/api/test_project_context.py`
  - `runtime/tests/api/test_gate_api.py`
  - `runtime/tests/api/test_artifact_api.py`
  - `runtime/tests/api/test_execution_api.py`
  - `runtime/tests/runs/test_run_service.py`
  - `runtime/tests/runs/test_worktree_manager.py`
  - `runtime/tests/executors/codex/test_adapter.py`
  - `apps/renderer/src/features/layout/WorkspaceContext.test.ts`
  - `apps/renderer/src/features/execution/ExecutionPage.test.ts`
  - `apps/desktop/tests/security.test.ts`
  - `packages/contracts/tests/rpc.test.ts`

## 中文注释范围

- `state_store.py`：Run 权威状态、Run 级锁和根投影不能反向覆盖的约束。
- `runs/service.py`：Run 创建时 phase_dir、权威状态和选中投影的写入顺序。
- `worktrees.py`：独立 worktree 防止多个 Codex session 覆盖同一工作目录的原因。
- `database.py`：旧 SQLite 表的增量补列迁移原因。
- `api/app.py`：Gate 权限来源、失败恢复和 Codex 上下文信任边界。

## TDD 记录

- 初始失败：`python -m pytest runtime/tests/runs/test_worktree_manager.py -q --tb=short`
  - 结果：collection 失败，`ModuleNotFoundError: harness_runtime.runs.worktrees`，符合新增 worktree manager 前的预期。
- Run/worktree：`python -m pytest runtime/tests/runs/test_run_service.py runtime/tests/runs/test_worktree_manager.py -q --tb=short`
  - 结果：`20 passed`。
- 状态兼容：`python -m pytest runtime/tests/persistence/test_state_store.py runtime/tests/runs/test_run_service.py -q --tb=short`
  - 结果：`30 passed`。
- Gate/Artifact/Execution：分别运行 API 聚焦测试。
  - 结果：Gate `4 passed`，Artifact `1 passed`，Execution `3 passed`。
- Runtime API：`python -m pytest runtime/tests/api -q --tb=short`
  - 结果：`15 passed`。
- Runtime 核心：persistence/runs/gates/artifacts/recovery 组合。
  - 结果：`56 passed`。
- 项目/协议/Workflow/Contract：组合测试。
  - 结果：`101 passed`。
- Codex：`python -m pytest runtime/tests/executors/codex -q --tb=short`
  - 结果：`7 passed`。
- Runtime 全量：`python -m pytest runtime/tests -q --tb=short`
  - 结果：`212 passed, 2 failed`；两项均为既有 `test_bridle_adapter.py` 对本机 PATH 中 `bridle` 的环境依赖，诊断为 `bridle not found at 'bridle'`。
- TypeScript 静态检查：Renderer、Desktop、Contracts 分别执行 `tsc --noEmit`。
  - 结果：全部退出码 0。
- Vitest：Renderer `8 passed`、Desktop `7 passed`、Contracts `7 passed`。
- Python 静态编译：`python -m compileall -q runtime/src`。
  - 结果：退出码 0。
- Lint：`python -m ruff check ...`。
  - 结果：未执行成功，本机未安装 `ruff`；不得记为 PASS。

## 开发边界与后续

- Developer 未标记 G3-G8，也未把缺失 `bridle` 的测试伪装为通过。
- 现有 README、旧打包产物、旧 Runtime 可执行文件和其他 Harness run 改动均未回退。
- 重新构建 Runtime、Electron 桌面包、安装包 hash 和桌面主路径 smoke 尚未执行；必须由后续 verifier 节点完成 Compile/Unit Test/Evidence 后再打包。
