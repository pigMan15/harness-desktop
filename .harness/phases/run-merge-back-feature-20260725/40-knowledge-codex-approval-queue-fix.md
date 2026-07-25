# Knowledge Codex 多审批队列修复

## 范围

修复 Codex synthesis 同一轮并发发出多个审批请求时，前端只处理一个、剩余请求永久等待的问题。

## 实现

- Renderer 将单值 `pendingApproval` 改为按 requestId 去重的 FIFO `pendingApprovals`。
- 一次轮询中的全部 `approval_required` 都进入队列；当前项响应成功后自动展示下一项。
- 审批面板显示当前位置和队列总数（例如 `1/4`）。
- 取消、结束或错误终止会话时清理审批队列。
- CodexAppServer 保存每个未决审批的完整事件，并在响应后按 requestId 删除。
- Knowledge active-session API 返回全部未决审批，切换模块后可恢复。
- turn 完成时清理后端过期审批状态。

## 验证

- `tsc --project apps/renderer/tsconfig.json --noEmit`：PASS
- `pnpm --filter @harness/desktop typecheck`：PASS
- `py -3 -m py_compile runtime/src/harness_runtime/executors/codex/app_server.py runtime/src/harness_runtime/api/app.py`：PASS
- `py -3 -m pytest runtime/tests/executors/codex/test_adapter.py -q`：PASS（7 passed）
- 单元场景覆盖两个审批 requestId 依次 allow/deny，并验证后端未决队列从 `[91, 92]` 变为 `[92]`，最终清空。

## 结果

多个审批不再丢失，Codex turn 可以在用户逐项授权后继续执行；模块切换后仍能恢复待审批项。