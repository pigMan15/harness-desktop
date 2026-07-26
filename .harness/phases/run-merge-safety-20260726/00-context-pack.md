# Context Pack

## 任务来源

- RunId: `run-merge-safety-20260726`
- 发起人: 用户
- 时间: 2026-07-26
- 输入: 用户确认采用“只读预检、结构化诊断、安全 Fast-forward、异常时用户接管”的 Run 合并方案。

## 需求摘要

当前 Runs 页面点击合并后立即调用 Runtime，失败信息仅显示为顶部文本。用户难以理解目标工作区脏、Run 工作区脏、Revision 冲突、分支分叉等场景，也不清楚哪些操作应由软件执行、哪些应由自己通过 Git 完成。本次改造在任何 Git 写操作前提供只读预检，展示分支关系、提交和文件变化，使用结构化问题卡给出原因与下一步，并只允许经过再次确认的 Fast-forward 合并。异常场景不自动丢弃、暂存、变基或解决冲突。

## 相关业务知识

| 知识点 | 摘要 | 来源 |
| --- | --- | --- |
| 当前合并方式 | Runtime 使用 `git merge --ff-only <run-branch>` | `runtime/src/harness_runtime/runs/service.py` |
| 现有保护 | 目标与 Run 工作区必须干净；Run revision 必须匹配；目标不能是 detached HEAD | `merge_run_back` |
| 现有错误展示 | Renderer 把少量错误码映射为一句英文，并显示在页面顶部 | `apps/renderer/src/features/runs/RunsPage.tsx` |
| 策略控制 | 合并操作受 Settings 的 `gitCommit` 策略控制 | Renderer 与 Desktop IPC |

## 相关历史经验

| 类型 | 结论 | 来源 |
| --- | --- | --- |
| pitfall | `TARGET_WORKTREE_DIRTY` 和 `RUN_WORKTREE_DIRTY` 携带大量文件时，单行 notice 难以阅读 | 用户反馈 |
| pitfall | 分支分叉时 `--ff-only` 只返回 Git 原始提示，用户不知道应 merge 还是 rebase | 用户反馈 |
| decision | 主体工作区存在修改时不得自动覆盖；差异必须由用户明确处理 | 本次用户确认方案 |

## 相关代码锚点

- Renderer: `apps/renderer/src/features/runs/RunsPage.tsx`
- Renderer API: `apps/renderer/src/app/harness-api.d.ts`
- Preload: `apps/desktop/src/preload/index.ts`, `apps/desktop/src/preload/harness-api.ts`
- Desktop IPC: `apps/desktop/src/main/index.ts`
- Runtime API: `runtime/src/harness_runtime/api/app.py`
- Runtime service: `runtime/src/harness_runtime/runs/service.py`
- Tests: `runtime/tests/runs/test_run_service.py`

## 业务不变量

- 预检不得修改 Git index、HEAD、分支或工作区文件。
- 目标工作区或 Run 工作区不干净时不得执行合并。
- Revision 在预检后发生变化时必须重新预检。
- 默认只支持 Fast-forward，不自动创建 merge commit 或 rebase。
- 不自动 stash、reset、discard、force push 或解决冲突。
- Runtime 必须保留最终权限和安全校验，不能只依赖前端按钮状态。

## 待确认问题

- 本阶段是否实现隔离 Worktree 的非 Fast-forward 合并：否，先交付安全预检与明确的用户接管路径。
- 是否由软件自动提交脏工作区：否，仅展示、打开终端和刷新。

## 风险判断

- Intent: `FEATURE`（用户确认）
- Risk: `MEDIUM`（用户确认）
- 风险理由: 涉及本地 Git 分支更新，但保持 Fast-forward-only、双工作区 clean check 和最终二次校验，风险可控。

## 知识来源

- Harness run: `run-merge-back-feature-20260725`
- 代码文件: 上述 Runtime、IPC、Renderer 与测试文件
- 用户决策: 当前对话确认的安全合并方案
