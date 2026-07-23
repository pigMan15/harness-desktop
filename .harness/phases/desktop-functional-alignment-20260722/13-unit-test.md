# 单元测试结果

- 节点：`UNIT_TEST`
- 角色：verifier
- 工作目录：`G:\Project\ai\harness-desktop`
- 结果：PASS

## 命令与结果

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `python -m pytest runtime\tests -q --tb=short` | 0 | Runtime 全量 214 项通过；包含项目、状态、Workflow、Gate、Artifact、Codex、Recovery、双 Run 与 worktree 隔离测试。 |
| `python -m pytest runtime\tests -q --tb=short -k "not bridle"` | 0 | 211 项通过、3 项按表达式取消选择；用于确认核心测试不依赖 Bridle 环境。 |
| `vitest run`（`apps/renderer`） | 0 | 3 个测试文件、8 项通过。 |
| `vitest run`（`apps/desktop`） | 0 | 1 个测试文件、7 项通过。 |
| `vitest run`（`packages/contracts`） | 0 | 1 个测试文件、7 项通过。 |

## 关键场景覆盖

- 两个 Run 的权威状态、revision、Gate、Artifact、phase_dir 和重试状态互不串线。
- 根 `.harness/state.json` 的旧投影不能覆盖 Run 权威状态。
- 两个 Run 创建不同 `codex/<run_id>` branch/worktree，并可独立修改同名文件。
- Execution session 固定绑定 project/run/worktree/thread/turn；切换 selected Run 后旧 session 仍按原 Run poll/respond/cancel。
- Gate G3-G8 权限检查和确定性评估由 Runtime 执行。
- Codex app-server initialize/thread/start/turn/start、审批、轮询和中断均有测试。

## G4 评估

- 门禁：`G4_UNIT_TEST`
- 结论：PASS
- 豁免：无。此前开发阶段曾因 PATH 缺少 Bridle 出现两项失败，本次 verifier 全量复核时 Bridle 三项已全部通过，因此不再保留豁免。
- 警告：FastAPI TestClient 输出一项 Starlette/httpx2 弃用警告，不影响测试结果，列为后续依赖升级风险。
