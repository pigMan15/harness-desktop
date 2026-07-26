# INTAKE

- Run ID: `run-merge-ui-encoding-fix-20260727`
- Intent: `BUG_FIX`
- Risk: `LOW`
- 问题：Runs 合并向导的 JSX 文字节点直接包含 `\uXXXX`，React 将其作为普通文本显示，造成标题、标签和按钮出现转义字符。
- 范围：修复 Runs 合并向导内所有 JSX 文字节点，并增加回归检查。
- 非目标：不修改 Runtime 合并逻辑、Git 安全策略或页面结构。
- 验收：界面不再出现字面量 `\uXXXX`；Renderer 类型检查、测试和构建通过。
