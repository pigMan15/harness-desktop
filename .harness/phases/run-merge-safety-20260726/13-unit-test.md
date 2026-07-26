# 单元测试结果

## Runtime Run Service

- 命令：`python -m pytest runtime/tests/runs/test_run_service.py -q`
- 退出码：`0`
- 结果：`PASS`
- 数量：`26 passed`
- 覆盖重点：真实 Git 仓库中的安全 Fast-forward、目标工作区脏、Run Worktree 脏、分支分叉，以及预检前后目标 HEAD 不变。

## Renderer

- 命令：`pnpm.cmd --filter @harness/renderer test`
- 退出码：`0`
- 结果：`PASS`
- 数量：`11 test files / 35 tests passed`
- 覆盖重点：只有干净且可 Fast-forward 的预检允许执行；已知 Git 阻塞状态提供中文操作指引。

## 结论

没有未解释的相关失败，`G4_UNIT_TEST = PASS`。
