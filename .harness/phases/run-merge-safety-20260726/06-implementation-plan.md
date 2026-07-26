# 实施计划

## 目标

交付只读合并预检、结构化阻塞原因和确认式 Fast-forward 合并体验，同时维持 Runtime 最终安全边界。

## 假设

- 本阶段只支持 `--ff-only`。
- Git CLI 已是现有 Runtime 的必要依赖。
- 文件和提交明细均限制返回数量，完整诊断可由用户在 Terminal 中查看。

## 任务列表

1. Runtime 预检测试（RED）
   - 编辑 `runtime/tests/runs/test_run_service.py`。
   - 构造临时 Git 主仓库与 Run worktree，覆盖 ready、target dirty、run dirty、diverged。
   - 验证预检不改变 HEAD。
   - 命令：`python -m pytest runtime/tests/runs/test_run_service.py -k merge -q`。
2. Runtime 最小实现（GREEN）
   - 编辑 `runtime/src/harness_runtime/runs/service.py`。
   - 提取共享上下文检查，新增 `preflight_run_merge_back`。
   - 编辑 `runtime/src/harness_runtime/api/app.py` 注册 RPC。
3. Desktop/Preload 契约
   - 编辑 `apps/desktop/src/main/index.ts`、`apps/desktop/src/preload/index.ts`、`apps/desktop/src/preload/harness-api.ts`。
   - 编辑 `apps/renderer/src/app/harness-api.d.ts` 增加结构类型与调用。
4. Renderer 行为测试（RED）
   - 新增或扩展 Runs 组件测试，覆盖打开预检、阻塞态、ready 态确认按钮。
5. Renderer 合并向导（GREEN）
   - 重构 `apps/renderer/src/features/runs/RunsPage.tsx`。
   - 新增结构化问题模型、摘要、提交/文件列表、技术详情、刷新和打开 Terminal。
   - 增加 Runs 专用 CSS，并确保窄屏可滚动。
6. 回归与门禁
   - Runtime 聚焦测试与完整相关测试。
   - Renderer typecheck、tests、build。
   - 记录命令、退出码和已知限制。

## 验证计划

- `python -m pytest runtime/tests/runs/test_run_service.py -q`
- `pnpm --filter @harness/renderer typecheck`
- `pnpm --filter @harness/renderer test`
- `pnpm --filter @harness/renderer build`
- 必要时运行 Desktop typecheck/build 验证 IPC 类型。

## 回滚计划

- 回退新预检 RPC/IPC 和 Renderer 抽屉，不更改已有 `run.mergeBack` 行为。
- 若预检数据在特定 Git 版本不可用，返回 `PREFLIGHT_FAILED` 并禁用合并，而不是降级为直接执行。

## TDD 记录模板

- 新增或选中的测试：Runtime merge preflight；Renderer Runs merge assistant。
- 初始失败：实现前记录缺少符号/API/行为的预期失败。
- 实现：最小满足测试的 Runtime 和 UI 改动。
- 聚焦结果：记录单文件/单模块结果。
- 扩展结果：记录 Renderer build 和相关 Runtime suite。
