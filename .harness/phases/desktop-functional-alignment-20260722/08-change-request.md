# 范围变更记录

- Run：`desktop-functional-alignment-20260722`
- 意图/风险：保持 `FEATURE / MEDIUM`，不得覆盖
- 状态：CONFIRMED
- 提出时间：2026-07-23T01:00:16+08:00
- 确认人：用户

## 变更原因

原方案将 `.harness/state.json` 作为项目唯一活动 Run 的可写状态，`runs/<run_id>/state.json` 仅作为切换快照。该模型可以管理多个 Run，但不能让同一项目中的多个 Run 安全并行执行：Gate、Artifact 和 Execution 会随 active Run 切换而漂移，多个执行器也会共享同一源码目录。

## 已确认目标

将“同项目多个 Run 真正并行开发”纳入本次交付范围：

1. `runs/<run_id>/state.json` 成为各 Run 的权威状态和 revision 来源。
2. 根 `.harness/state.json` 仅保留协议兼容投影，不作为并行执行事实源。
3. Run 相关业务 API 显式使用 `projectId + runId + expectedRevision`；不得依赖隐藏 active Run。
4. Gate、Artifact、Execution Session 固定绑定指定 Run，启动后不得因 UI 切换任务而漂移。
5. 每个并行开发 Run 使用独立 Git branch/worktree；多个 Run 不直接并发修改同一源码目录。
6. 使用 Run 级锁保护状态写入，不用项目级 active state 串行化所有 Run。
7. Workflow 仍为项目级配置，新 Run 创建时冻结 `required_nodes`；已有 Run 不静默迁移。
8. UI 的 selected/active Run 仅表示当前视图和默认操作目标，不改变后台执行会话归属。

## 验收增量

- 同一项目至少两个 Run 可同时启动执行，状态、revision、阶段产物和事件互不串线。
- 切换 UI 选中 Run 不改变已启动 Execution Session 的 `runId` 和 worktree。
- 两个 Run 可分别评估 Gate，结果只写入各自状态文件。
- 两个 Run 在独立 worktree 修改同名源码文件时不会直接覆盖；合并冲突交由 Git 合并流程显式处理。
- Runtime 重启后可以从 session 记录恢复或明确标记每个 Run 的执行状态，不误操作其他 Run。

## 影响与后续

- 原 `03-solution-design.md` 中“Gate 始终绑定项目 active Run”的决策被本记录替换为“Gate 显式绑定 Run，selected Run 仅作 UI 默认值”。
- 原 `06-implementation-plan.md` 的 Run、Gate、Execution、Desktop Bridge 和 Renderer 任务必须增加 `runId`、Run 级状态存储及 worktree 生命周期。
- 这是状态权威边界和接口契约变更；继续相关编码前应更新方案与实施计划，并补充对应测试。
- 本记录不修改当前 route、intent、risk、completed nodes 或 G1-G8 门禁状态。

## 用户确认

- 决定：确认纳入“同项目多个 Run 真正并行开发”。
- 确认时间：2026-07-23T01:00:16+08:00
- 授权范围：允许更新方案、实施计划和验收标准后继续自主开发。
