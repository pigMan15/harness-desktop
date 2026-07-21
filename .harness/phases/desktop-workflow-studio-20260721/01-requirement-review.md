# 需求评审 — Phase 3 Workflow Studio

**目标**：可视化编辑 `.harness/workflow.yaml`，编译检查 + diff + 版本历史 + ZIP 导入导出。

## 验收标准

- [ ] **标准 1（Draft Service）**：草稿保存在 SQLite（不污染项目 `.harness/`）。compile 成功→生成规范化 YAML + semantic diff。apply 携带 expected hash + 获取项目锁 + 原子替换。
  - 验证：`pytest runtime/tests/workflow/test_drafts.py -v`
- [ ] **标准 2（Version History）**：保存版本（content_hash/yaml/author/summary/time）。恢复版本也走 compile/apply。
  - 验证：`pytest runtime/tests/workflow/test_versioning.py -v`
- [ ] **标准 3（ZIP Import/Export）**：导出包含 workflow + agent + gate 文件的 ZIP。导入拒绝 Zip Slip、symlink、超大文件。
  - 验证：`pytest runtime/tests/workflow/test_zip_io.py -v`
- [ ] **标准 4（Workflow Canvas）**：React Flow 展示 Node Catalog。支持添加/删除/复制/排序节点。系统最低节点锁图标+删除不可用。
  - 验证：`pnpm --filter @harness/renderer test -- workflow-studio`
- [ ] **标准 5（Route Editor + Compile）**：按 Intent/Risk 切换路由。Save 先 compile→错误定位到节点/字段→成功显示 diff→二次确认。
  - 验证：Renderer component tests
- [ ] **标准 6（Diagnostics Panel）**：编译错误/警告显示在面板中，定位到具体节点

## G1 预评：PASS（目标+验收+开放问题均记录）
