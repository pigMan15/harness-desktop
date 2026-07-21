# 方案设计 — Phase 3 Workflow Studio

## 架构

```
apps/renderer/features/workflow-studio/
  WorkflowCanvas.tsx   ← React Flow 画布
  NodeCatalog.tsx      ← 内置/自定义节点列表
  RouteEditor.tsx      ← Intent/Risk 路由编辑
  DiagnosticsPanel.tsx ← 编译错误/警告面板
  useWorkflowDraft.ts  ← Zustand store (draft state + undo/redo)

runtime/workflow/
  drafts.py            ← SQLite draft CRUD
  versioning.py        ← version history + restore
  zip_io.py            ← ZIP import/export (防 Zip Slip)
```

## 关键设计

- **Draft state**：Renderer 内 Zustand store，不写文件。Save 时→ Runtime API compile → 返回 diagnostics + diff → 用户确认 → apply
- **React Flow**：nodes = workflow.nodes（排序的线性列表），edges = 单向箭头（只到下个节点）。禁止并行边
- **系统节点锁定**：`SYSTEM_MINIMUM_RULES` 中的节点（COMPILE/UNIT_TEST/EVIDENCE_CAPTURE）显示 🔒 图标，删除按钮 disabled
- **ZIP 安全**：`zipfile.Path` 逐一检查 name 不含 `..` 和绝对路径，解压前验证文件大小 < 1MB
- **Version history**：SQLite `workflow_versions` 表已存在（M2 Task 2.2），直接用

## 回滚

- Draft 回退：Zustand undo/redo栈
- apply 失败：旧 workflow.yaml 不变（hash check 保护）
- 导入 ZIP 失败：全部拒绝，不部分写入
