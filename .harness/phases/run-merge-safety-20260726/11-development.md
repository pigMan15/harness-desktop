# 开发记录

## 实现结果

- 新增只读 Runtime RPC `run.mergeBackPreflight`。
- 预检返回目标/Run 分支、HEAD、ahead/behind、Fast-forward 判定、工作区状态、提交和文件变化。
- 预期 Git 异常转为结构化 issue，不再依赖超长异常字符串作为主要 UI。
- Desktop/Preload 增加 `run:merge-back-preflight`，该调用不经过写操作策略确认。
- Runs 合并按钮改为打开侧边合并向导，不再立即修改仓库。
- 向导展示安全结论、分支关系、统计、问题卡、技术详情、文件和提交列表。
- 只有 ready、Fast-forward、无 issue 且用户勾选已审阅时才允许执行。
- Run Worktree 脏时可打开 Run Terminal；其他阻塞场景可复制 Git 检查命令并刷新。
- 实际执行仍调用原 `merge_run_back`，保留 revision、clean status、detached HEAD 和 `--ff-only` 最终校验。

## 变更文件

- `runtime/src/harness_runtime/runs/service.py`
- `runtime/src/harness_runtime/api/app.py`
- `runtime/tests/runs/test_run_service.py`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/harness-api.ts`
- `apps/renderer/src/app/harness-api.d.ts`
- `apps/renderer/src/features/runs/RunsPage.tsx`
- `apps/renderer/src/features/runs/merge-assistant.ts`
- `apps/renderer/src/features/runs/merge-assistant.test.ts`
- `apps/renderer/src/features/runs/runs.css`

## 编码思路

- Runtime 为安全事实来源；Renderer 只负责解释和引导。
- 预检与执行分离，执行阶段不信任旧预检结果。
- 本阶段不引入非 Fast-forward 写路径，避免在主体工作区留下冲突状态。
- 文件和状态条目限制返回数量，防止长日志撑坏页面。

## 中文注释范围

- UI 使用中文解释自动化边界和用户接管动作。
- Runtime 核心函数 docstring 明确预检不得修改 HEAD、Index 或工作区；现有文件存在编码异常，未扩大无关注释修复范围。

## TDD 记录

- Runtime 初始失败：`ImportError: cannot import name 'preflight_run_merge_back'`。
- Runtime 实现后：4 个真实 Git 预检场景通过。
- Renderer 初始失败：缺少 `./merge-assistant` 模块。
- Renderer 实现后：合并可执行判定和中文问题引导测试通过。
- 扩展结果：Runtime Run Service 26 tests PASS；Renderer 11 files / 35 tests PASS；Desktop/Renderer typecheck PASS；Renderer build PASS。

## 工作区保护

- 开始前确认 `main` 工作区包含大量用户和既有改动；未回退或清理任何无关文件。
- 因 Windows ACL 导致内置补丁工具无法更新现有文件，使用带精确上下文保护的临时编辑脚本；脚本执行后已删除。
