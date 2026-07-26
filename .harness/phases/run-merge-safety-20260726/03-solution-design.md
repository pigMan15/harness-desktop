# 方案设计

## 现状上下文

`RunsPage` 直接调用 `mergeRunBack`；Runtime 在一次调用中验证并执行 `git merge --ff-only`。错误通过异常字符串返回，Renderer 仅识别三个错误码并压缩为页面顶部 notice。现有 Runtime 安全校验正确，但缺少执行前的可视化信息和稳定的结构化问题模型。

## 推荐方案

新增 `run.mergeBackPreflight`，复用与执行路径相同的只读检查逻辑，并返回统一数据：

- `status`: `ready | blocked | merged`
- `canMerge`: 是否允许调用执行 API
- `targetBranch`, `branchName`, `targetHead`, `runHead`
- `ahead`, `behind`, `fastForward`
- `targetStatus`, `runStatus`: 总数及截断后的文件条目
- `commits`: Run 相对目标的提交摘要（限制数量）
- `files`: `git diff --name-status target...run` 的文件变化（限制数量）
- `fileSummary`: added/modified/deleted/renamed/other
- `issues`: `{ code, severity, title, description, action, details[] }[]`

Renderer 点击合并图标后打开侧边抽屉并加载预检。只有 `canMerge=true` 时显示最终确认操作；确认仍经过 Settings `gitCommit` 策略并调用现有 `mergeRunBack`。失败后保留抽屉和结构化诊断，并允许重新预检。

## 受影响文件/模块

- `runtime/src/harness_runtime/runs/service.py`: 预检模型、Git 只读检查、执行路径复用。
- `runtime/src/harness_runtime/api/app.py`: 注册 `run.mergeBackPreflight`。
- `apps/desktop/src/main/index.ts`: 新 IPC `run:merge-back-preflight`。
- `apps/desktop/src/preload/index.ts`: 暴露预检调用。
- `apps/desktop/src/preload/harness-api.ts`: 类型声明。
- `apps/renderer/src/app/harness-api.d.ts`: Renderer 契约类型。
- `apps/renderer/src/features/runs/RunsPage.tsx`: 合并抽屉、问题卡、确认流程。
- Runs 样式文件或公共样式: 抽屉、摘要网格、文件列表和响应式布局。
- Runtime/Renderer tests: 安全场景和 UI 状态。

## 数据流

1. 用户点击合并图标。
2. Renderer 调用 `mergeRunBackPreflight(projectId, runId, revision)`。
3. Runtime 只读获取两个 HEAD、工作区状态、merge-base、ahead/behind、commit/file diff。
4. Runtime 返回 `canMerge` 与结构化问题；不抛出可预期 Git 状态异常。
5. Renderer 展示摘要和操作边界。
6. 用户确认后，Renderer 执行策略确认并调用 `mergeRunBack`。
7. Runtime 再次完整检查并只执行 `merge --ff-only`。

## 安全与失败预演

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| 预检后仓库被修改 | 并发 Git 操作 | 执行阶段重新检查 revision、HEAD 和 clean status | merge API 返回结构化/原始错误 | 不执行或 ff-only 失败，HEAD 不变 |
| 大量文件撑坏 UI | 状态/差异过长 | Runtime 截断条目并返回 total | Renderer 长列表测试 | 回退为摘要+技术详情 |
| 非 FF 被错误合并 | 分支分叉 | `merge-base --is-ancestor` + 执行仍用 `--ff-only` | Runtime 单元测试 | 无写入发生 |
| Git 输出编码异常 | Windows 路径 | 结构化数组传输，不依赖单行字符串解析 | 非 ASCII 文件名测试/手工验证 | 显示原始详情 |

## 兼容性

- 保留现有 `run.mergeBack` 和 Renderer 调用签名。
- 新 API 为增量能力；旧 Runtime 缺少方法时 Renderer 显示诊断失败，不执行合并。
- 不改变 Run state schema，只有成功合并时仍写现有 `merged_*` 字段。

## 回滚

- 删除预检 IPC/API 和抽屉，恢复直接调用按钮即可。
- Runtime `merge_run_back` 的最终安全逻辑保持兼容，可独立保留。
- 本次不引入数据库迁移或 Git 仓库持久化元数据。

## 被拒绝的替代方案

- 自动 stash/commit：可能改变用户历史和遗漏敏感文件。
- 自动 rebase：重写 Run 分支历史，且冲突处理不可安全自动化。
- 直接在主体分支尝试普通 merge：失败可能留下冲突中的 index/worktree。
- 本阶段实现隔离集成 Worktree：价值较高，但范围和测试面超过本次 MEDIUM 交付，后续单独实现。
