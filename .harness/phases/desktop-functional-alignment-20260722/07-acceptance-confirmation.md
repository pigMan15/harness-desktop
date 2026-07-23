# 验收确认

- 状态：CONFIRMED
- Run：`desktop-functional-alignment-20260722`
- 意图/风险：`FEATURE / MEDIUM`
- 需求依据：`01-requirement-review.md`
- 方案依据：`03-solution-design.md`
- 实施依据：`06-implementation-plan.md`

## 待用户确认的产品决策

1. “任务”作为用户界面主称呼，与 `.harness` v1 的 Run 一一对应；创建时仍由用户指定 Run ID、Intent、Risk。
2. 用户必须先显式选择项目；不存在隐式 `local` 或 cwd 默认项目。
3. Workflow 是项目配置态，修改只影响新任务；活动 Run 展示冻结路线，不静默迁移。
4. Gates 始终显示并使用所选项目的 active Run，不存在隐藏默认 Run；G3-G8 继续受 verifier 权限约束。
5. Codex 使用可执行的本机 CLI，并通过 app-server 双向协议接入审批；WindowsApps 内置但外部不可执行的路径不视为可用。
6. Fake Executor 只保留测试，不作为生产界面默认执行入口。
7. 完成定义包含跨层主路径验证和重新构建 Runtime/Windows 安装包；不包含签名和干净 VM 升级/卸载声明。

## 验收边界

验收采用 `01-requirement-review.md` 中 16 条标准，核心可观察结果为：

- 多项目选择和数据隔离成立；
- 任务 Run 可创建、持久化、切换、暂停、恢复；
- Workflow 草稿完整 round-trip、可编译、可 diff、可按 hash 应用；
- Gates 明确归属 active Run，不能任意写状态；
- Codex 可探测、启动、流式展示、审批和取消；
- Runtime/Renderer/Desktop 测试与构建通过；
- 新安装包内 Runtime 来自本次 clean build。

## 确认记录

- 确认人：用户
- 决定：确认验收标准并继续
- 时间：2026-07-23T00:19:28+08:00
- 意见：接受上述产品决策、范围和验收边界，进入 DEVELOPMENT。

## 范围变更确认

- 变更记录：`08-change-request.md`
- 决定：确认纳入“同项目多个 Run 真正并行开发”。
- 时间：2026-07-23T01:00:16+08:00
- 调整：各 Run 使用独立权威状态、revision 和 Git worktree；Gate、Artifact、Execution 显式绑定 `projectId + runId`，根 `state.json` 仅作为兼容投影。
- 影响：本节替换上文“Gates 始终使用 active Run”的单例约束；selected Run 仅作为 UI 默认目标，不得改变后台会话归属。
- 后续：按 `08-change-request.md` 更新方案、实施计划和增量验收测试后继续 DEVELOPMENT。

## 多 Run 并行增量验收

- 两个 Run 的权威 state、revision、retry_counts、gates 和 phase_dir 独立。
- Gate/Artifact/Execution 显式传 runId；缺失或跨 Run session 操作失败。
- UI 切换 selected Run 不改变已启动 session 的 runId、worktree 或审批 requestId。
- Git 项目为每个开发 Run 创建独立 branch/worktree；不同 worktree 修改同名文件不直接覆盖。
- Runtime 重启后 session 恢复结果包含原 projectId/runId/worktree，无法恢复时只标记对应 session lost。

## 阻塞记录

- 原因：连续三个 goal 回合未收到验收确认，不能越过人工确认节点进入源码修改。
- 阻塞时间：2026-07-23T00:15:41+08:00
- 解除方式：用户明确回复“确认验收标准并继续”，或给出需要调整的决策/验收项。
- 解除结果：用户已于 2026-07-23T00:19:28+08:00 明确确认，阻塞解除。
