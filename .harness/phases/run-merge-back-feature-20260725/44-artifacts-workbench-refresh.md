# Artifacts 工作台界面优化

## 范围

- 将 Artifacts 页面从简单列表和预览卡片改为文件浏览器与文档阅读器双栏布局。
- 增加文件名搜索、类型筛选、自动选择首个产物和按 Run 恢复上次选中产物。
- 增加 Markdown 渲染/源码切换、刷新、复制产物路径和复制 SHA-256 操作。
- 将加载、错误、空结果和预览截断状态分别展示，避免将加载提示误显示为错误。
- 增加桌面双栏与窄屏上下布局，保持文件列表和阅读区域独立滚动。

## 变更文件

- `apps/renderer/src/features/artifacts/ArtifactsPage.tsx`
- `apps/renderer/src/features/artifacts/ArtifactsPage.test.ts`
- `apps/renderer/src/app/styles.css`
- `tests/e2e/artifacts-workbench.spec.ts`

## 验证

- `pnpm.cmd --filter @harness/renderer typecheck`：通过。
- `pnpm.cmd --filter @harness/renderer test`：通过，6 个测试文件、21 项测试全部通过。
- `pnpm.cmd --filter @harness/renderer build`：通过；保留项目现有的大于 500 kB chunk 警告。
- 使用本机 Chrome 执行 `pnpm.cmd exec playwright test tests/e2e/artifacts-workbench.spec.ts`：通过，2 项场景验证桌面/窄屏布局及主要审阅交互。
- `git diff --check`：通过。

## 说明

- 首次 Playwright 启动因未安装 Playwright 自带 Chromium 失败，改用本机 Chrome 后验证通过，未下载额外浏览器依赖。
- 本次不修改 Runtime 或 Electron IPC 协议。
