# 实施计划 — Phase 4

| Task | 文件 | 测试 |
|---|---|---|
| 5.1 Executor Contract | `runtime/executors/base.py` + `fake.py` | `test_executor_contract.py` |
| 5.2 Codex Adapter | `runtime/executors/codex/*.py` (3 files) | `test_adapter.py` |
| 5.3 Approval Service | `runtime/approvals/service.py` + `policy.py` | `test_policy.py` |
| 5.4 Execution UI | `apps/renderer/features/execution/` (3 files) | component tests |

**TDD**：Fake Executor 先 → Runtime+UI 集成 → Codex Adapter（probe 真实 Codex，缺失时诊断不标 PASS）
