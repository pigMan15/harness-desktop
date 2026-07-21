# 实施计划 — Phase 3

## Task 4.1：Draft + Version Service（~6 files）

| 文件 | 内容 |
|---|---|
| `runtime/workflow/drafts.py` | SQLite CRUD（drafts 表）、compile_draft()、 semantic_diff()、apply_draft()（hash+lock 原子替换） |
| `runtime/workflow/versioning.py` | save_version()、list_versions()、restore_version() |
| `runtime/workflow/zip_io.py` | export_zip()（workflow+agent+gate）、import_zip()（防 Slip/symlink/超大） |
| `runtime/tests/workflow/test_drafts.py` | CRUD/compile/diff/apply/hash 冲突/lock |
| `runtime/tests/workflow/test_zip_io.py` | 有效导出/导入/Zip Slip 拒绝/symlink 拒绝 |

## Task 4.2：Workflow Studio UI（~7 files）

| 文件 | 内容 |
|---|---|
| `apps/renderer/.../workflow-studio/WorkflowCanvas.tsx` | React Flow 画布 + 节点拖拽 + 线性边 |
| `apps/renderer/.../workflow-studio/NodeCatalog.tsx` | 内置节点列表 + 拖拽到画布 + 系统节点锁图标 |
| `apps/renderer/.../workflow-studio/RouteEditor.tsx` | Intent/Risk 下拉切换 + 当前路由预览 |
| `apps/renderer/.../workflow-studio/DiagnosticsPanel.tsx` | compile 错误列表 + 点击跳转到节点 |
| `apps/renderer/.../workflow-studio/useWorkflowDraft.ts` | Zustand store |
| `apps/renderer/tests/workflow-studio/` | component tests |

**TDD**：先写 Python 后端测试 → 实现 → 再写 UI 组件测试 → 实现。
