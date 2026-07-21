# 失败预演 — Phase 2 State Machine

节点：PRE_MORTEM　角色：quality-guardian

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
|---|---|---|---|---|
| **Protocol 过严拒绝合法项目** | validator 规则过度匹配（如误判合法 run_id） | 以 M1 9 fixture 为回归基线；新增规则先写失败测试 | `test_harness_v1_fixtures.py` valid 回归失败 | 降级 validator 为 M1 宽松模式 |
| **原子写损坏 state.json** | Windows 文件锁行为差异、磁盘满、fsync 失败后 os.replace 仍执行 | 故障注入测试：mock os.replace/os.fsync 失败 → 验证旧文件完整、不报成功 | `test_state_store.py` 故障注入用例 | 跳过 fsync 降级为非原子写 + 日志 |
| **SQLite 损坏** | 异常退出时 WAL 文件不一致、并发写入（单用户不应出现） | WAL 模式 + 启动时 `PRAGMA integrity_check` | integrity_check 失败 → 返回诊断 | 删除 `.db`，从项目 `.harness/` 重建（OQ-1） |
| **Compiler 误拒合法 workflow** | 系统规则检查过于严格（如误判缺少必含节点） | 以 valid fixture workflow 为基线；simulate() 结果与预期比对 | `test_compiler.py` 合法编排被拒 | 增加 rule override 豁免机制 |
| **Revision 冲突误报** | 文件 hash 算法在 Windows CRLF/LF 转换下不稳定 | hash 用 SHA-256 of bytes（非文本）；读文件用 `rb` 模式 | 单用户操作出现 REVISION_CONFLICT | 改用 content-based hash 对比 |
| **Gate 权限绕过** | verifier-only 检查漏掉某个调用路径 | G3-G8 评估前强制检查 `caller_role == "verifier"` | `test_gate_engine.py` 非 verifier 标记 G3 → PERMISSION_DENIED | 权限检查提升到 Gate Engine 入口（不可绕过） |
| **Artifact 路径穿越** | Windows junction / symlink 未被检测 | `Path.resolve()` + 与授权根目录 `commonpath` 比对 | `test_artifact_service.py` 路径穿越 fixture | 拒绝所有非 `commonpath` 结果，返回错误 |
| **run_id 注入** | 含 `..` 或 `C:` 的 run_id 被接受 | run_id 正则 + `Path` 安全校验在 `mkdir` 前 | `test_run_service.py` 恶意 run_id | 返回 `RUN_ID_INVALID` 不创建目录 |

## 停止条件
- `test_state_store.py` 任一故障注入未通过
- `test_gate_engine.py` 权限绕过成功
- `test_artifact_service.py` 路径穿越成功
- 合法 valid fixture 被 Protocol Adapter 拒绝
- SQLite integrity_check 持续失败且重建无效
