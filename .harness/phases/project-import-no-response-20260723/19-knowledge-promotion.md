# 知识沉淀草稿

## 来源

- RunId：`project-import-no-response-20260723`
- Intent：`BUG_FIX`
- Risk：`MEDIUM`
- Phase dir：`.harness/phases/project-import-no-response-20260723`
- 原始输入：用户现象“导入项目没反应”、`00-intake.md`、既有 Desktop 架构与打包说明
- 证据：`11-development.md`、`12-compile.md`、`13-unit-test.md`、`15-evidence.json`、`18-acceptance-report.md`

## 候选知识

| 类型 | 优先级 | 领域 | 置信度 | 标题 | 相对原始输入的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pattern | 高 | Electron/测试 | 高 | OS 能力 handler 应提取为可注入纯边界 | 原始实现把 `dialog.showOpenDialog`、窗口查找和 Runtime RPC 内嵌在 `app.whenReady()`，行为无法单测。提取 handler 并注入 `getWindow/showOpenDialog/runtimeCall` 后，可以在 Node Vitest 中稳定覆盖选择、取消、无窗口、空路径和异常，同时保留 Electron Main 的 OS 能力所有权。 | Desktop 5 项新增测试；`project-import.ts`；G4 PASS | Electron 架构/测试模式：Main 进程 OS 能力边界 |
| pattern | 高 | 前端交互 | 高 | 异步命令必须显式建模 success/cancel/error | “Promise 完成但列表不变化”会被用户理解为没反应。将 import 流程建模为 success/cancelled/error outcome，并由页面统一维护进行中、notice 与 finally 恢复，可以让幂等成功和用户取消也有可观察结果。 | Renderer 4 项新增测试；`ProjectsPage.tsx`；用户原始现象已消除 | 前端交互规则：异步命令反馈状态 |
| pitfall | 高 | Electron 打包 | 高 | 手工 Vite 构建 Forge 应用需补生产常量与 CJS 格式 | README 的离线 packager 路径默认 `.vite` 已由 Forge 正确构建。若手工调用 Vite，必须显式注入 `MAIN_WINDOW_VITE_DEV_SERVER_URL=undefined`、`MAIN_WINDOW_VITE_NAME=main_window`，并把 Main/Preload 输出为 CJS；否则包虽然生成，启动时只有主进程或报 ESM 加载错误。 | v1/v2 启动失败；v3 app.asar 检查与 packaged smoke 通过 | Windows 构建手册：Forge 离线构建前置条件 |
| rule | 高 | 发布验证 | 高 | Electron package 成功必须验证 app.asar 语义和真实首窗 | `electron-packager` 退出码 0 只证明文件被复制，不能证明 Main bundle 可执行。至少应检查未解析 Forge 常量、模块格式、关键修复字符串，并真实启动首窗与 bundled Runtime；目录/EXE 存在不构成可用证据。 | v1/v2 均成功生成目录但无法加载页面；v3 首窗、Runtime 和导入 smoke 通过 | Harness build/evidence rule：桌面包可执行性门禁 |
| pitfall | 中 | Runtime 生命周期 | 中高 | Runtime healthy 与首个业务 IPC 之间可能存在短暂竞态 | packaged smoke 首个导入请求连续 4 次收到 `Runtime not started`，第 5 次成功，说明页面可进入时业务 handler 仍可能短暂没有 supervisor port。当前修复让错误可见；更完整的产品策略应在 Runtime ready 前禁用导入，或只对该瞬态错误做有界重试。 | `packaged-import-smoke.json` 的 `importAttempts: 5`；最终业务结果成功 | Runtime/Desktop 生命周期历史问题；后续改进候选 |

## 不建议沉淀的内容

- 本次 Setup/nupkg 的具体 hash：属于当前发布证据，不是长期工程规则。
- v1/v2/v3 目录名和精确 PID：只用于当前 run 审计与清理。
- Playwright 对本机 Windows 系统目录框的单次替换失败：可保留“系统模态框需要单元测试加人工/专用 UI 自动化”的方法边界，不应沉淀本机操作细节。
- “Projects 页面要显示 Importing”这一具体文案：产品行为已进入源码和验收报告，长期知识应保留抽象的异步结果状态规则。
- Runtime 自动重试作为既定产品规则：本次只验证了竞态存在，尚未实施或确认自动重试策略，因此只列为 pitfall/候选，不升级为硬规则。

## 待用户确认

- 是否把“OS 能力 handler 可注入测试”写入 Electron Main 开发规范。
- 是否更新 README 离线打包章节，明确 Forge 生产常量和 CJS 输出要求。
- 是否把“包目录存在不等于可运行，必须首窗 + Runtime smoke”提升为 Harness 构建证据规则。
- 是否另开 BUG_FIX Run，在 Runtime ready 前禁用 Projects 导入按钮，消除启动竞态。
- 本草稿未写入 Obsidian、LLM Wiki 或长期知识库。
