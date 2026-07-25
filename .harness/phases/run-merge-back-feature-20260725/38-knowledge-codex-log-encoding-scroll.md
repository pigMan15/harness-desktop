# Knowledge Codex 日志编码与滚动修复

## 问题

- Codex synthesis 执行器仅显示 `userMessage`、`reasoning`、`agentMessage` 等事件名，事件详情和结构化错误不可读。
- Windows PowerShell 读取无 BOM UTF-8 知识库文件时依赖默认代码页，命令输出会出现中文乱码。
- 日志持续追加时，执行器滚动条不会保持在最底部。
- stderr 中的 ANSI 颜色控制码直接显示为转义字符。

## 实现

- Knowledge 日志格式化器递归提取事件中的 text/content/delta/message/reason/output，使用中文事件名称展示。
- 结构化错误通过 JSON 格式化展示，避免 `[object Object]`。
- 清理 stdout/stderr 中的 ANSI 控制码。
- 日志列表更新或恢复会话后，通过 `requestAnimationFrame` 将日志容器滚动到 `scrollHeight`。
- Knowledge Codex 开发者指令和合成 prompt 明确要求 Windows PowerShell 使用 `Get-Content -Encoding utf8` 或等价 UTF-8 方式读写文本。

## 验证

- `tsc --project apps/renderer/tsconfig.json --noEmit`：PASS
- `pnpm --filter @harness/desktop typecheck`：PASS
- `py -3 -m pytest runtime/tests/executors/codex/test_adapter.py -q`：PASS（7 passed）
- `py -3 -m py_compile runtime/src/harness_runtime/api/app.py runtime/src/harness_runtime/knowledge/shared_repo.py`：PASS

## 注意

- 已产生的乱码日志无法无损恢复；新启动的 Codex synthesis 会应用 UTF-8 读取约束。
- 本次未改动共享知识库仓库，也未提交其文件。