# DESIGN — Phase 5

- **Audit**: SQLite audit_events 表已有 → 写入 wrapper + query API
- **Idempotency**: request_dedup 表已有 → 中间件检查 request_id → 重复返回缓存
- **Recovery**: 启动扫描项目 + 检查 session pid → 存活=重连, 死亡=记录, 孤儿=清理
- **Knowledge**: review 状态机 (draft→reviewed→accepted/rejected)
- **Packaging**: PyInstaller .spec + Forge squirrel config（structural, 待 Electron env）
