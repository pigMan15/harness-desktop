# Knowledge Codex 多审批停滞诊断

## 现象

Codex synthesis 在完成知识库根目录读取后停止继续输出，最后日志连续出现多个只读命令审批请求。

## 结论

执行器不是模型推理卡死，而是在等待未被 UI 暴露的审批响应。

## 证据链

1. 附件日志在末尾连续产生 4 个 `approval_required`：查找 CLAUDE.md、查找 AGENTS.md、查看 .harness、递归列出仓库文件。
2. `CodexAppServer._handle_server_request` 会为每个请求保留独立 requestId，服务端在收到每个 requestId 的响应前都会保持等待。
3. `KnowledgePage.pollCodex` 对一次轮询返回的事件使用 `events.find(...)`，只把第一个审批保存到单值 `pendingApproval`。
4. 轮询接口会 drain 已返回事件；同一批次剩余审批不会再次返回。
5. 用户响应当前审批后，`respondCodex` 直接将 `pendingApproval` 清空，没有切换到剩余审批。

## 影响

当 Codex 并发发起两个或更多审批请求时，UI 最多可处理一个；其余请求留在后端 `_approval_methods` 中，Codex turn 永久等待，表现为执行一半卡住。

## 建议修复

- 将前端单值 `pendingApproval` 改为按 requestId 去重的审批队列。
- 每次响应后自动展示队列中的下一项。
- 恢复会话时由后端返回当前所有未决审批，避免切换模块后丢失。
- 可选：对安全的只读命令提供明确的 session 级授权策略，但不能依赖它替代审批队列。