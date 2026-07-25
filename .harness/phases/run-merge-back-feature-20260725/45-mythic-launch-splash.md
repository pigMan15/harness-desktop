# 神话风开屏动画

## 目标

参考 Hermes Agent 官网的神话视觉语言，为 Harness Desktop 增加应用启动开屏，同时避免延长 Runtime 初始化时间或在启动首帧透出工作台。

## 实现

- 增加约 2.05 秒的全屏开场，主界面在遮罩下并行初始化。
- 使用实色钴蓝、古典衬线标题、放射符文环和 Harness 工作流图腾形成神话感。
- 开屏退出时通过收束动画平滑露出工作台。
- Electron BrowserWindow 背景同步为钴蓝色，覆盖 Renderer CSS 加载前的空白窗口。
- 支持 `prefers-reduced-motion`，减少动态效果时约 480 毫秒内完成。
- 未使用外部人物或网站素材；ImageGen 内置工具在当前会话不可用，因此采用确定性的 CSS 与现有 Lucide 图标实现。

## 变更文件

- `apps/renderer/src/features/layout/LaunchSplash.tsx`
- `apps/renderer/src/features/layout/LaunchSplash.test.ts`
- `apps/renderer/src/app/App.tsx`
- `apps/renderer/src/app/styles.css`
- `apps/desktop/src/main/index.ts`
- `tests/e2e/launch-splash.spec.ts`

## 验证

- Renderer 与 Desktop TypeScript 类型检查通过。
- Renderer：7 个测试文件、23 项测试全部通过。
- Desktop：5 个测试文件、32 项测试全部通过。
- Renderer 生产构建通过；保留项目原有的大于 500 kB chunk 警告。
- 使用本机 Chrome 执行 2 项 Playwright 场景，验证 1280×800、720×720、动画退出和 reduced-motion，全部通过。
- 已检查 Playwright 截图，开屏从首帧完全覆盖窗口，文本和图腾无溢出。
