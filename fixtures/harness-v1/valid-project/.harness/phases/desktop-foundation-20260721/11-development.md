# 开发记录 — Harness Desktop Foundation (M1)

节点：DEVELOPMENT　角色：developer　产物：`11-development.md`
上游：`06-implementation-plan.md`、`10-coding-design.md`

## Task 0.1：初始化仓库与 pnpm 工作区 ✅

**日期**：2026-07-21
**commit**：`805f6b5` — `chore: initialize harness desktop workspace`

### 变更文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `.gitignore` | 新建 | node_modules/__pycache__/.venv/dist/out/.pnpm-store 等 |
| `.editorconfig` | 新建 | indent=2 space, LF, UTF-8, trim trailing whitespace |
| `package.json` | 新建 | 根 workspace: private=true, scripts: lint/typecheck/test/test:e2e/build/package |
| `pnpm-workspace.yaml` | 新建 | packages: apps/*, packages/* |
| `tsconfig.base.json` | 新建 | target=ES2022, module=ESNext, moduleResolution=bundler, strict=true |
| `runtime/pyproject.toml` | 新建 | requires>=3.11, deps: fastapi/uvicorn/pydantic, dev: pytest/ruff/mypy |
| `runtime/src/harness_runtime/__init__.py` | 新建 | `__version__ = "0.0.0"` + 模块级中文 docstring |
| `runtime/tests/__init__.py` | 新建 | 空文件（标记为测试包） |
| `runtime/tests/test_smoke.py` | 新建 | `test_runtime_import()`：验证 harness_runtime 可 import 且版本为 0.0.0 |

### 中文注释范围

- `runtime/src/harness_runtime/__init__.py`：模块级 docstring 用中文说明 Runtime 职责（API/Protocol/Workflow/Run/Gate/Artifact/Executor）、M1 范围与后续 Phase 预留

### TDD 记录

- **新增测试**：`runtime/tests/test_smoke.py::test_runtime_import`（冒烟测试）
- **初始失败**：pytest 退出码 5（0 tests collected），证明新仓库无测试基础设施
- **实现**：创建 `runtime/src/harness_runtime/__init__.py` + `runtime/tests/__init__.py` + `test_smoke.py`
- **聚焦结果**：1 passed, exit 0 ✓
- **扩展结果**：`pnpm typecheck` 退出 0（无 TS 项目，符合预期）；`py -3 -m pip install --no-deps -e runtime` 退出 0

### 验证结果

```
pnpm install                        → exit 0 (Already up to date)
pip install --no-deps -e runtime    → exit 0 (harness-runtime-0.0.0 installed)
pnpm typecheck                      → exit 0 (No projects matched — expected)
pytest runtime/tests -q             → exit 0 (1 passed)
```

## 下一步

Task 0.2：CI 与质量基线（4 文件：ci.yml + ruff.toml + vitest.workspace.ts + playwright.config.ts）
