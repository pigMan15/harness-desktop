# Context Pack — Phase 3 Workflow Studio

**RunId**: `desktop-workflow-studio-20260721` | **前置 Run**: M1 (`desktop-foundation`) + M2 (`desktop-state-machine`)
**参考**: `doc/desktop-implementation-plan.md` Task 4.1-4.2、`doc/desktop-architecture.md` §9

## 需求摘要

在 M2 Runtime（Protocol Adapter + Workflow Compiler + State Store + Dispatcher）上构建可视化 Workflow Studio。用户可在 React Flow 画布上拖拽内置/自定义节点，编辑角色/产物/Gate，按 Intent/Risk 切换路由，保存前自动 compile→显示 semantic diff→用户确认→原子替换 workflow.yaml。版本历史存在 SQLite 中，支持恢复。ZIP 导入导出防 Zip Slip。

## 相关代码锚点

- **M2 Runtime（直接依赖）**：`workflow/compiler.py`（compile/simulate）、`workflow/dispatcher.py`（next_node）、`persistence/state_store.py`（atomic write）、`protocol/loader.py`（load_workflow）、`protocol/models.py`（WorkflowDefinition/NodeDefinition）
- **M1 UI**：`apps/renderer/src/app/App.tsx`（React 壳，需扩展路由）
- **待创建**：`runtime/workflow/drafts.py`、`runtime/workflow/versioning.py`、`apps/renderer/src/features/workflow-studio/`

## 业务不变量（继承 M1+M2 全部）

- 系统最低节点不可删除（显示锁图标）
- v1 线性路由：拒绝并行/DAG/循环
- compile 失败不写项目文件
- apply 需 expected workflow hash + 项目锁
- 活动 Run 路由冻结，修改只影响新 Run

## 开放问题

- Change request diff UI 是否包含在本 Run？（OQ-3 从 M2：决定 API 先做，UI 留 Phase 4 — 但本 Run 就是 Phase 4 的 Workflow Studio，可以包含）
