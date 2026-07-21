# 方案设计 — Phase 4

## 架构

```
runtime/executors/
  base.py        ← ExecutorAdapter ABC (probe/start/stream/respond/cancel/recover)
  fake.py        ← Fake Executor（可脚本化输出/审批/失败/超时/恢复）
  codex/
    adapter.py   ← Codex Adapter（子进程 spawn + stdin/stdout JSON 协议）
    events.py    ← 事件解析（ExecutionOutput/ToolCall/ApprovalRequested/Exited）
    process.py   ← 子进程管理（pid/start-time 防复用）

runtime/approvals/
  service.py     ← 分类文件/命令/网络/部署/删除/权限/危险 Git
  policy.py      ← allow-once/deny/受控前缀；禁止通用 shell/python 前缀

apps/renderer/features/execution/
  ExecutionPage.tsx  ← 流式日志 + 工具调用 + 审批 + 取消/恢复
```

## 关键设计

- **Executor Contract**：统一接口（probe→start→stream events→user respond→cancel/recover）
- **Codex 通信**：stdin JSON-RPC / stdout JSON 事件流
- **审批分类**：8 类（file/cmd/network/external/deploy/delete/perm/dangerous-git）
- **Fake Executor**：可脚本化场景，先跑通 Runtime↔UI 集成，不依赖真实 Codex

## 回滚

- Codex 不可用 → 显示诊断（路径/版本/能力），不标测试 PASS
- cancel 优雅终止 → SIGTERM → 超时 5s → SIGKILL
- recover 用 session 表中的 pid + start_time 防 PID 复用
