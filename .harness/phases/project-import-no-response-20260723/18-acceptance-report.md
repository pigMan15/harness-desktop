# 验收报告

- Run：`project-import-no-response-20260723`
- 意图/风险：`BUG_FIX / MEDIUM`
- 问题：当前打包桌面软件点击“Import project”后缺少可观察响应
- 综合结论：建议 `PASS`

## 修复范围

本次修复覆盖 `ProjectsPage -> preload -> Electron Main IPC -> native dialog -> Runtime project.import -> project list/select` 主路径。Renderer 现在明确显示导入进行中、取消、成功与失败；Electron Main 的导入 handler 已提取为可测试模块，显式路径不再错误依赖 BrowserWindow，系统对话框的无窗口、取消、空选择和异常均返回结构化结果。Runtime 项目注册逻辑经 17 项聚焦测试确认无回归，未做无证据的 Python 修改。

## 验收结果

| # | 结果 | 结论与证据 |
| ---: | :---: | --- |
| 1 | PASS | v3 打包应用能够加载 Projects 页面；实际点击尝试打开了 Windows 系统模态目录框，Playwright 因无法稳定控制该原生窗口而阻塞。Main 单测验证 dialog 调用，Renderer 包与测试验证 `Importing...`、按钮禁用及最终恢复。真实键鼠完成选择仍列为人工确认项。 |
| 2 | PASS | Renderer 流程测试验证成功后严格执行 `import -> refresh -> select` 并返回成功提示；v3 packaged smoke 真实导入 `valid-project`，返回 `healthy`、项目 ID `b2b58fa30c10`，列表出现且按钮显示 `Selected`。`app.asar` 已确认包含成功/进度实现。 |
| 3 | PASS | Desktop 测试验证取消不调用 Runtime；Renderer 测试验证显示 `Project import cancelled`、不刷新/选择且按钮通过 `finally` 恢复。原生取消键鼠未自动执行，覆盖边界已明确记录。 |
| 4 | PASS | v3 packaged smoke 对不存在路径返回 `Project path does not exist or is not a directory`；Desktop/Renderer 测试覆盖 dialog 异常、Runtime 错误和 IPC 抛错，不添加虚假项目。 |
| 5 | PASS | Desktop handler 测试证明显式绝对路径不需要窗口、不打开 dialog，并原样传给 `project.import`；dialog 分支覆盖无窗口、空选择和异常的结构化错误。 |
| 6 | PASS | Desktop/Renderer 类型检查通过；Desktop 12、Renderer 12、Contracts 7、Runtime 17 项测试通过；Renderer 生产构建通过；v3 unpacked、Setup 和 nupkg 均已生成，packaged import smoke 最终退出码 0。 |

## 关键修复

- 新增 `apps/desktop/src/main/project-import.ts` 和 5 项 handler 行为测试。
- 新增 `apps/renderer/src/features/projects/project-import.ts` 和 4 项流程测试。
- Projects 页面现在显示 `Importing...`，取消为中性提示，成功为绿色提示，失败为错误提示。
- 显式路径导入不再因缺少 BrowserWindow 失败；native dialog 异常不会悬空 Promise。
- 项目成功后刷新列表并自动选择，不再依赖列表是否产生肉眼可见变化来表达成功。

## 验证汇总

- `G1_REQUIREMENTS`：PASS
- `G2_DESIGN`：PASS
- `G3_COMPILE`：PASS
- `G4_UNIT_TEST`：PASS
- `G5_ATDD`：NOT_REQUIRED
- `G6_EVIDENCE`：PASS
- `G7_PRERELEASE`：NOT_REQUIRED
- `G8_ACCEPTANCE`：等待 verifier 独立复核

最终交付目录：`dist-project-import-fix-20260723-v3`

- Setup：`desktop-installer/Harness Desktop-0.0.0 Setup.exe`
  - SHA-256：`1EDA9182EAC5ED83ECC8AA8BD47EB38B63B77B751158B49DFAD9FE55FE1F6F4C`
- nupkg：`desktop-installer/harness-desktop-0.0.0-full.nupkg`
  - SHA-256：`7CF43BCB5BFE9D881DD44301909E76298261F7C9B09713E0FBE760231E709508`
- 包内 Runtime：`20,605,604` 字节
  - SHA-256：`9E90B9E1FB8B4FFA971E58F2E91BD84C3C9C32FF76D8F315D292885F0BDFAD3B`
- `app.asar` 已验证 Main 为 CJS，并包含新 import handler；Renderer bundle 包含进度和取消文案。

## 失败与取舍

- 第一次离线包未注入 Forge 生产常量，第二次 bundle 使用错误 ESM 格式；两次均被启动 smoke 捕获，最终 v3 使用生产常量和 CJS 格式修正。v1/v2 只作为失败证据保留。
- Playwright 不能稳定驱动 Windows 原生目录模态框，因此未伪造系统 dialog 键鼠通过；采用 Main 可注入单元测试加 v3 显式路径 packaged smoke 的组合证据。
- packaged smoke 在 Runtime 启动阶段前 4 次返回 `Runtime not started`，第 5 次成功；目前错误会清晰显示，后续可以在 Runtime ready 前禁用导入按钮以进一步改善体验。

## 剩余风险

1. 需要在最终安装包中人工点击一次系统目录选择器并完成选择，做视觉与键鼠确认。
2. 安装包未签名，未在干净 Windows VM 执行安装、升级和卸载矩阵。
3. Playwright 强制关闭的 5 秒兜底可能留下 bundled Runtime，本次已按精确 PID 清理；正常窗口关闭路径会调用 `supervisor.shutdown()`。
4. Vite CJS Node API 弃用警告待后续工具链升级处理。

## 验收建议

“导入项目没反应”的确定性代码原因已修复，相关跨层测试和 v3 packaged import smoke 均通过，所有已确认标准有可观察证据。建议 verifier 将 `G8_ACCEPTANCE` 标记为 `PASS`，随后进入 `KNOWLEDGE_PROMOTION`。

## G8 独立复核

- 复核角色：verifier
- 复核结果：`PASS`
- 范围检查：报告覆盖 Renderer、Desktop IPC、native dialog 边界、Runtime 项目导入和最终 Windows 包。
- 验证检查：6 条验收标准均映射到单元/回归测试、生产构建、app.asar 检查或 v3 packaged smoke；失败打包与自动化尝试未被隐藏。
- 风险检查：原生 dialog 人工确认、Runtime 启动竞态、Playwright 清理、签名/干净 VM 和 Vite 警告均已列出。
- 结论：报告满足 `.harness/evals/gates.yaml` 对 G8 的范围、验证和剩余风险要求。
