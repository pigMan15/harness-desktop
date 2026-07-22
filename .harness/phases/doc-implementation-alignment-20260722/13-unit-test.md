# 单元测试结果

## 命令记录

| 命令 | 工作目录 | 退出码 | 结果 | 关键输出 |
| --- | --- | --- | --- | --- |
| `pnpm test` | `G:\Project\ai\harness-desktop` | 1 | FAIL | Vitest workspace 扫描 `runtime/.pytest_cache` 时 EPERM，未进入有效包测试。 |
| `C:\Users\15330\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m pytest runtime\tests -q` | `G:\Project\ai\harness-desktop` | 1 | BLOCKED | bundled Python 无 `pytest` 模块。 |
| `python -m pytest runtime\tests -q` | `G:\Project\ai\harness-desktop` | 1 | BLOCKED | 当前 shell 中 `python` 命令不存在。 |
| `pnpm --filter @harness/desktop test` | `G:\Project\ai\harness-desktop` | 0 | PASS | `apps/desktop/tests/security.test.ts`：1 个文件、6 个测试通过。 |
| `pnpm --filter @harness/contracts test` | `G:\Project\ai\harness-desktop` | 0 | PASS | `packages/contracts/tests/rpc.test.ts`：1 个文件、6 个测试通过。 |
| `pnpm --filter @harness/renderer test` | `G:\Project\ai\harness-desktop` | 1 | WAIVED | renderer 包无测试文件，Vitest 以 `No test files found` 退出；已在差异清单记录为测试缺口。 |

## 结论

- 结果：WAIVED
- 原因：本次改动涉及文档、Preload/Desktop/Renderer TypeScript 小修；可用的 desktop security tests 和 contracts tests 均通过，renderer 测试文件缺失和 Python pytest 环境不可用已明确记录。
- 后续动作：后续 run 应补齐 renderer 组件测试、修正 Vitest workspace 对 Python cache 目录的扫描问题，并在可用 Python dev 环境中执行 `python -m pytest runtime/tests -q`。
