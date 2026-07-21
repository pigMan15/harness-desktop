# Worktree 创建 — Harness Desktop Foundation (M1)

节点：WORKTREE_CREATION　角色：state-keeper　产物：`10-worktree.md`

## Worktree 评估

**结论：本节点不创建独立 git worktree。**

- Worktree 隔离通常用于并发修改同一仓库的不同分支（或防止破坏性实验污染主工作目录）。
- M1 为全新仓库初始化，尚无并发分支冲突场景。
- 开发分支 `codex/desktop-foundation` 将直接在仓库根目录工作。
- 若后续 Phase（如 Phase 3+ 并行 Workflow Studio 与 Runtime 开发）出现并发需求，届时再用 `git worktree add` 创建隔离工作目录。

## 记录

- **worktree 路径**：N/A（主工作目录 `G:\Project\ai\harness-desktop`）
- **关联分支**：`codex/desktop-foundation`
- **创建命令**：N/A
- **原因**：初始单分支开发，无并发隔离需求；创建空 worktree 无意义且违反"每个任务先写失败测试再实现"原则（无测试场景）。本产物记录决策即完成节点义务。
