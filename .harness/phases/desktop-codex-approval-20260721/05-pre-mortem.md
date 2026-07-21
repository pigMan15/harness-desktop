# PRE_MORTEM — Phase 4

| 失败模式 | 预防 |
|---|---|
| Codex 子进程僵尸 | pid + start_time 防复用；超时 SIGKILL |
| 审批绕过 | 8 类白名单 + 禁止通用 shell/python 前缀 |
| Fake 与真实行为不一致 | Fake 可脚本化所有场景；contract test 验证一致性 |
| 事件流断连 | 按 sequence 号补发；recover 重连 |
