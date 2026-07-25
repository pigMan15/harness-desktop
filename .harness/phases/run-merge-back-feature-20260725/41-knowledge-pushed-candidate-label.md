# Knowledge 已推送标签与重复推送

## 需求

- 已通过软件推送到共享知识库的沉淀记录显示标签。
- 标签不能阻止再次选择、合成和推送同一记录。

## 实现

- `knowledge_candidates` 增加 `push_count` 和 `last_pushed_at`，并在 `_ensure_table` 中兼容迁移已有 SQLite 表。
- Preview/Codex synthesis 将实际候选 ID 贯穿 Runtime session、preview event、Preload/IPC 和 Push API。
- 只有成功执行 `Push via App` 后才增加推送次数；仅勾选、合成失败或推送其他本地改动不会误标。
- 候选保持 `accepted`，复选框不禁用，可以再次生成预览并重复推送。
- 卡片展示绿色 `已推送` 标签；重复推送显示 `已推送 ×N`，悬停可查看最后推送时间。
- 推送成功后刷新当前候选列表并清空本次预览关联，避免后续无关 push 重复计数。

## 验证

- `tsc --project apps/renderer/tsconfig.json --noEmit`：PASS
- `pnpm --filter @harness/desktop typecheck`：PASS
- `py -3 -m py_compile runtime/src/harness_runtime/knowledge/service.py runtime/src/harness_runtime/knowledge/shared_repo.py runtime/src/harness_runtime/api/app.py`：PASS
- `py -3 -m pytest runtime/tests/knowledge/test_promotion.py -q`：PASS（7 passed）
- 新增场景验证同一 accepted 候选连续标记两次后 `push_count == 2`，状态仍为 `accepted`。

## 边界

- 标签由 Harness Desktop 的 `Push via App` 成功结果驱动；在软件外自行执行 Git push 不会自动更新该标签。