# 验收报告

- Runs 合并向导中的标题、分支标签、区块标题、按钮和说明文字不再显示 `\uXXXX`。
- UTF-8 中文同时适用于 JSX 文字节点和 JavaScript 字符串。
- 新增源码回归测试，防止后续再次把 Unicode 转义直接写入 JSX。
- Renderer 类型检查、36 项测试和正式构建通过。
- 结论：修复满足截图反馈，`G8_ACCEPTANCE = PASS`。
