# 开发记录

- Run：`project-import-no-response-20260723`
- 意图/风险：`BUG_FIX / MEDIUM`
- 节点：`DEVELOPMENT`
- 依据：`01-requirement-review.md`、`06-implementation-plan.md`

## 根因

1. Renderer 在开始导入后只禁用按钮，按钮文字仍是 `Import project`；用户取消 native dialog 时故意忽略 `cancelled`，成功时也没有任何成功消息。对于已在列表中的项目，成功导入不会产生明显列表变化，因此用户可观察结果就是“没反应”。
2. Electron Main 的 `project:import` handler 在判断显式路径前先要求存在 BrowserWindow。直接路径导入本不需要窗口，却可能返回 `No window available`；dialog 抛错和未返回路径也没有结构化处理。
3. Desktop 既有测试只检查 preload 源码安全字符串，没有覆盖 `project:import` IPC 的 dialog、cancel、路径转发与错误分支；Renderer 也没有导入流程测试，因此上述行为未被门禁发现。
4. Runtime 项目注册、校验和显式项目上下文不是根因：聚焦 17 项测试在可写临时目录中全部通过，故未修改 Python Runtime。

## 实现变更

- 新增 `apps/desktop/src/main/project-import.ts`
  - 提供可注入的 `createProjectImportHandler`。
  - 显式路径直接调用 Runtime，不依赖窗口。
  - dialog 分支处理无窗口、用户取消、空路径和异常，统一返回 `{ error }`。
- 修改 `apps/desktop/src/main/index.ts`
  - 用新 handler 注册 `project:import`，继续由 Electron Main 持有系统 dialog 能力、Runtime 持有项目写入能力。
- 新增 `apps/desktop/tests/project-import.test.ts`
  - 覆盖直接路径、dialog 成功、取消、无窗口、异常和空选择。
- 新增 `apps/renderer/src/features/projects/project-import.ts`
  - 抽取纯 async 导入流程，固定 `import -> refresh -> select` 顺序，并返回 success/cancelled/error outcome。
- 修改 `apps/renderer/src/features/projects/ProjectsPage.tsx`
  - 导入期间显示 `Importing...`。
  - 取消显示中性提示，成功显示项目名，失败显示错误；所有路径在 `finally` 恢复按钮。
- 修改 `apps/renderer/src/app/styles.css`
  - 增加与既有 notice 样式一致的成功状态。
- 新增 `apps/renderer/src/features/projects/project-import.test.ts`
  - 覆盖成功顺序、取消、Runtime 错误、IPC 异常和页面接线。

## TDD 记录

- 初始环境失败：直接调用 pnpm 时 child PATH 缺少 `node`，测试未开始；改用工作区绑定 Node 路径后重跑，不将该次记为测试红灯。
- Desktop 初始失败：`Failed to load ../src/main/project-import`，符合新 handler 尚不存在的预期。
- Renderer 初始失败：`Failed to load ./project-import`，符合新流程模块尚不存在的预期。
- 最小实现后聚焦结果：
  - Desktop：2 个文件、12 项通过，其中新增导入测试 5 项。
  - Renderer：4 个文件、12 项通过，其中新增导入测试 4 项。
- TypeScript 开发自检：Desktop 与 Renderer `tsc --noEmit` 均退出码 0。
- Runtime 初次聚焦失败：17 项均在 fixture setup 前因默认 `%TEMP%/pytest-of-15330` 无权限报错，不是业务失败。
- Runtime 重试：使用当前 phase_dir 作为 `--basetemp` 并关闭不可写 cache 后，17 项全部通过。

## 中文注释范围

- 新增逻辑保持短小且类型命名可说明行为，未添加冗余代码注释。
- 用户可见提示沿用当前英文界面语言，未混入中英文不一致文本。

## Developer 边界

- Developer 未标记 G3-G8。
- 尚未声称生产构建或新桌面包通过；这些必须由 verifier 在后续 COMPILE、UNIT_TEST 和 EVIDENCE_CAPTURE 节点独立执行。
- 未回退工作树中既有 README、旧 Harness run、旧测试或打包产物改动。
