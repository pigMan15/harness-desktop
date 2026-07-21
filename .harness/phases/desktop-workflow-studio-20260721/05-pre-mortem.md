# 失败预演 — Phase 3

| 失败模式 | 预防 | 停止条件 |
|---|---|---|
| React Flow 渲染异常（大 workflow） | 节点上限 50；虚拟滚动 | canvas 白屏 |
| ZIP Slip 逃逸 | `..` / 绝对路径 / symlink 拒绝 | 任一逃逸成功 |
| compile 错误未定位到节点 | diagnostics 携带 JSON Pointer | 错误无 pointer |
| 系统节点被误删 | UI 层 disabled + API 层拒绝 | 系统节点从 workflow 消失 |
| Draft 丢失 | 自动保存到 SQLite（debounce 2s） | 刷新后 draft 为空 |
| apply 覆盖他人修改 | expected hash + project lock | hash 不匹配仍写入 |
