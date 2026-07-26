# 需求评审

## 目标

将 Runs 模块的 Worktree 合并从“点击后直接执行、失败后显示一行错误”升级为可预检、可解释、可确认的安全流程，使用户在不熟悉 Git 异常细节时也能判断下一步，同时确保失败不会错误修改主体代码。

## 范围

- 新增 Run merge-back 只读预检 Runtime API。
- 返回目标分支、Run 分支、HEAD、ahead/behind、工作区状态、提交摘要和文件变化。
- 使用稳定的问题代码表达阻塞原因。
- Runs 页面提供合并抽屉/向导、问题卡、技术详情与刷新入口。
- 可安全 Fast-forward 时，用户确认后调用现有合并 API。
- 失败时提供查看文件、复制建议命令、打开 Run Terminal 或自行 Git 操作的说明。

## 非目标

- 自动创建非 Fast-forward merge commit。
- 自动 rebase、stash、reset、discard 或冲突解决。
- 自动提交用户未提交的文件。
- 自动推送远程仓库。

## 验收标准

- [ ] 点击未合并 Run 的合并按钮时，首先打开预检界面，不立即改变目标 HEAD。
  - 验证方式：调用 preflight 前后读取目标 HEAD，二者一致。
- [ ] 可 Fast-forward 且两个工作区干净时，预检展示来源/目标分支、提交数量、文件统计和提交列表，并启用最终合并按钮。
  - 验证方式：Runtime 单元测试和 Renderer 测试断言返回字段与按钮状态。
- [ ] 目标工作区脏时，预检返回 `TARGET_WORKTREE_DIRTY`，展示文件列表和“由用户 Commit/Stash 后刷新”的建议，合并按钮禁用。
  - 验证方式：临时 Git 仓库产生目标修改，断言 HEAD 不变且 issue 内容正确。
- [ ] Run 工作区脏时，预检返回 `RUN_WORKTREE_DIRTY`，展示文件列表和打开 Run Terminal 的操作，合并按钮禁用。
  - 验证方式：临时 Run worktree 产生修改，断言无 Git 写操作。
- [ ] 分支分叉时，预检返回 `NON_FAST_FORWARD`，说明本版本不会自动 rebase/解决冲突，并提供用户自行 Git 处理路径。
  - 验证方式：构造双方各有提交的仓库并检查预检结果。
- [ ] Run revision 变化、分支缺失、worktree 缺失或 detached HEAD 均显示独立问题标题，而不是整段原始日志。
  - 验证方式：错误映射单元测试或组件行为测试。
- [ ] 执行合并时 Runtime 再次执行 revision、clean status 和 `--ff-only` 校验。
  - 验证方式：保留并扩展 Runtime merge-back 测试。
- [ ] 用户可展开技术详情查看原始 Git 信息，但长日志不会撑坏页面布局。
  - 验证方式：Renderer 构建与组件测试。

## 开放问题

- 隔离 Worktree 的非 Fast-forward 合并放入后续独立功能，本次只显示明确的手动接管流程。
- “打开主项目 Terminal”当前没有专门 API，本次优先提供复制命令和刷新；Run 工作区可跳转现有 Execution/Terminal。

## 风险备注

- Git 状态可能在预检与确认之间变化，因此执行 API 必须保留全部最终校验。
- 文件列表可能很长，Runtime 返回需截断并提供总数。
- Windows 路径和 Git 输出可能包含非 ASCII 字符，数据结构应保持 UTF-8，不拼接成不可解析的单行错误。
