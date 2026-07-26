# 验收报告

## 范围总结

Runs 模块的 Worktree 合并已由直接执行按钮升级为安全合并向导。用户在任何 Git 写操作前可以看到只读预检结果、分支关系、提交和文件变化，并明确知道哪些问题由软件阻止、哪些操作需要自己通过 Git 完成。

## 交付内容

- Runtime 新增只读 `run.mergeBackPreflight`。
- Desktop/Preload/Renderer 契约已接通。
- 新增合并抽屉、结构化问题卡、技术详情、文件和提交预览。
- 支持刷新预检、复制 Git 检查命令、Run Worktree 脏时打开 Run Terminal。
- 只有安全 Fast-forward、无阻塞问题且用户确认已审阅时才能执行。
- 执行阶段继续保留 revision、双工作区 clean check、detached HEAD 和 `--ff-only` 校验。

## 安全性结论

- 预检只运行只读 Git 命令，不修改 HEAD、Index 或工作区。
- 目标或 Run 工作区存在未提交修改时，软件不会自动 stash、commit、discard 或 reset。
- 分支分叉时软件不会自动 rebase、创建 merge commit 或解决冲突。
- 预检与执行之间状态变化时，Runtime 最终校验会阻止过期操作。

## 验证总结

- Desktop typecheck：PASS。
- Renderer build：PASS。
- Runtime Run Service：26 tests PASS。
- Renderer：11 files / 35 tests PASS。
- 真实 Git 场景覆盖：安全 FF、目标脏、Run 脏、双方分叉；预检前后目标 HEAD 保持不变。

## 剩余风险

- 尚未进行 Electron 窗口中的人工视觉验收。
- 非 Fast-forward 隔离合并尚未实现，当前会安全阻止并引导用户手动处理。
- 大型仓库的文件明细会截断展示，完整信息通过 Git 命令查看。
- Renderer 仍存在原有的大 chunk 构建警告。

## 验收结论

需求中确认的第一阶段安全合并流程已实现，失败场景不会错误更改主体代码。`G8_ACCEPTANCE = PASS`。
