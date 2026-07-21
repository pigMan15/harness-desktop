# 编码设计 — Phase 3

**推荐方案**：后端优先（Task 4.1 draft/versioning/zip → 全 pytest）→ 前端（Task 4.2 React Flow → vitest）

**架构风格**：
- Renderer: Zustand store（undo/redo 栈）+ React Flow（线性节点+单向边）
- Runtime: SQLite drafts 表 + compile API + hash-lock apply
- API: `workflow.draft.save/compile/apply`、`workflow.version.list/restore`、`workflow.zip.export/import`

**模块边界**：Renderer 只通过 `window.harness` → IPC → Runtime API 通信。不直接写文件。

**Commit 策略**：Task 4.1 一个 commit + Task 4.2 一个 commit。

**确认后立即 DEVELOPMENT。**
