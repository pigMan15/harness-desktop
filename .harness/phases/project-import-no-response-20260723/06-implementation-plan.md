# 实施计划

## 目标

用最小、可测试的跨层改动修复 Projects 导入无反馈问题：Electron Main 对目录选择和 RPC 转发提供确定性结果，Renderer 对进行中、取消、成功和失败提供明确状态，并在真实桌面包中验证有效 Harness 项目能够导入和自动选择。

## 假设

- Runtime `project.import` 和 project registry 的基础行为已有 Python 测试；除非新复现证明 Runtime 返回错误，否则不修改其持久化逻辑。
- 当前最明确的缺口是 Desktop IPC handler 未被行为测试覆盖，以及 Renderer 对取消和成功完全无消息、按钮无进行中文字。
- 原生 Electron dialog 无法在 node 环境直接交互，需提取可注入 handler 做 mock 单元测试，再用桌面 smoke 补足。
- 现有仓库没有 jsdom/React Testing Library；Renderer 导入流程提取为纯 async 函数即可可靠测试状态结果，页面只负责渲染。

## 任务列表

1. 建立 Electron Main 失败测试
   - 新增：`apps/desktop/tests/project-import.test.ts`
   - 目标文件：拟新增 `apps/desktop/src/main/project-import.ts`
   - 覆盖：直接路径不打开 dialog；`__dialog__` 打开目录选择；取消不调用 Runtime；有效选择原样转发绝对路径；无窗口、dialog 抛错和 Runtime 错误均返回结构化 `{ error }`。
   - 初始验证：`pnpm.cmd --filter @harness/desktop test -- project-import.test.ts` 应因模块不存在而失败。

2. 实现可注入的项目导入 handler
   - 新增：`apps/desktop/src/main/project-import.ts`
   - 修改：`apps/desktop/src/main/index.ts`
   - 将原内嵌 `project:import` 逻辑提取为依赖 `runtimeCall`、`showOpenDialog`、`getWindow` 的小函数；直接路径无需窗口，dialog 路径捕获异常并验证返回路径；保持 Runtime 为唯一项目写入口。
   - 聚焦验证：Desktop 新测试与原 `security.test.ts` 全部通过。

3. 建立 Renderer 导入流程失败测试
   - 新增：`apps/renderer/src/features/projects/project-import.test.ts`
   - 新增：`apps/renderer/src/features/projects/project-import.ts`
   - 修改：`apps/renderer/src/features/projects/ProjectsPage.tsx`
   - 覆盖：cancelled、error、success 三种结果；成功严格按 refresh 后 select 的顺序执行；异常转成可见错误。
   - 初始验证：聚焦 Vitest 在实现前因模块/期望行为缺失而失败。

4. 完善 Projects 可观察状态
   - 修改：`apps/renderer/src/features/projects/ProjectsPage.tsx`
   - 导入期间按钮显示 `Importing...` 并禁用；取消显示中性提示；成功显示项目名/路径的成功提示；失败使用错误 notice；所有路径在 `finally` 恢复按钮。
   - 如需样式仅修改：`apps/renderer/src/app/styles.css`，复用既有 notice/badge 色彩，不扩展无关视觉系统。

5. 复核 Runtime 项目导入契约
   - 读取/运行：`runtime/tests/projects/test_project_service.py`、相关 API 测试。
   - 仅当测试证明 Runtime 错误响应或路径处理存在断点时修改 `runtime/src/harness_runtime/api/app.py` 或 `projects/service.py`；否则不扩大源码范围。

6. 扩展验证并重新打包
   - 运行 Desktop/Renderer 聚焦与全量 Vitest、两模块 `tsc --noEmit`、Renderer production build。
   - 在新输出目录重新生成桌面 unpacked/installer，不复用旧 `out-fresh`；若 Runtime 源码未变，可使用已验证 clean Runtime，但必须记录其 hash 并确认包内一致。
   - 运行 unpacked Electron smoke，实际触发导入 handler；自动化无法操作原生 dialog 时，用 handler 测试覆盖 dialog 分支，并用直接路径 IPC/Runtime 场景验证导入、列表刷新和选择结果。

## 验证计划

| 层级 | 命令/检查 | 通过条件 |
| --- | --- | --- |
| Desktop TDD | `pnpm.cmd --filter @harness/desktop test -- project-import.test.ts` | 新 handler 的 direct/dialog/cancel/error 分支全部通过 |
| Renderer TDD | `pnpm.cmd --filter @harness/renderer test -- project-import.test.ts` | cancel/error/success/异常及 refresh-select 顺序通过 |
| Desktop 回归 | `pnpm.cmd --filter @harness/desktop test` | 全量 Desktop Vitest 退出码 0 |
| Renderer 回归 | `pnpm.cmd --filter @harness/renderer test` | 全量 Renderer Vitest 退出码 0 |
| 类型检查 | Desktop、Renderer 各自 `tsc --noEmit` | 退出码 0 |
| Runtime 聚焦 | `python -m pytest runtime/tests/projects runtime/tests/api/test_project_context.py -q --tb=short` | 项目注册、校验与显式上下文测试通过 |
| 生产构建 | `pnpm.cmd --filter @harness/renderer build` 及桌面打包命令 | 退出码 0，生成新的输出目录 |
| 桌面验收 | 启动新 unpacked 应用并执行项目导入 smoke | bundled Runtime 存活；有效项目可导入、列出和选择；错误与取消可观察 |

## 回滚计划

- `project-import.ts` 仅封装现有 handler，可通过恢复 `index.ts` 原内嵌 handler 并删除新文件回滚，不影响其它 IPC。
- Renderer 纯流程函数和提示状态不改变项目协议；恢复 `ProjectsPage.tsx` 即可回滚 UI 行为。
- 不迁移数据库、不修改 `.harness` 文件格式；回滚不需要数据修复。
- 新桌面包验证失败时保留上一有效安装包，并将 G3/G4/G6 记为失败后按 Harness 路由回退，不覆盖旧产物。

## G2 评估

- 本 BUG_FIX/MEDIUM 路线不包含独立 `SOLUTION_DESIGN` 节点；本计划已包含受影响文件、可注入边界、TDD 顺序、验证命令、打包检查和回滚方案。
- 计划结论：满足当前路线的设计与实施要求，可进入 `DEVELOPMENT`。
