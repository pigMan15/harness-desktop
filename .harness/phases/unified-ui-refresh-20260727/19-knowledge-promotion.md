# 知识沉淀草稿

## 来源

- RunId：`unified-ui-refresh-20260727`
- Intent：FEATURE
- Risk：MEDIUM
- Phase dir：`.harness/phases/unified-ui-refresh-20260727`
- 原始 PRD / context-pack：全项目统一 UI、克制动画、窄屏适配、减少动态效果支持，并保持业务逻辑和 Terminal 交互不变

## 候选知识

| 类型 | 标题 | 相对 PRD 的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- |
| pattern | 脏工作区中的兼容式主题层 | 当全局样式文件承载大量既有功能且工作区存在未提交改动时，可新增最后加载的独立主题 CSS，通过语义令牌和现有 class 做渐进覆盖；入口单行导入即可整体回滚，避免重写页面和覆盖用户改动。 | `03-solution-design.md`、`11-development.md`、Renderer build/test 全通过 | 前端架构 / 设计系统 / 渐进式 UI 改造 |
| pattern | 用源码契约测试保护视觉系统 | 纯 CSS 改造也可以通过读取样式源码验证设计令牌、加载顺序、模块覆盖、响应式断点和 reduced-motion，从而把视觉架构约束纳入稳定单测；本次先得到 theme.css 不存在的预期失败，再实现至 41 项测试通过。 | `theme.test.ts`、`13-unit-test.md`、`15-evidence.json` | 前端测试 / CSS 契约测试 |
| rule | 页面间距必须令牌化并被契约测试保护 | 多模块桌面应用容易在页面级 padding、section gap、grid gap 上各自漂移；应在主题层抽象统一 spacing token，并用契约测试固定关键页面根类名和模块布局选择器。 | `spacing.test.ts`、`theme.css`、`20-spacing-followup.md` | 前端布局 / 设计系统 / 模块一致性 |
| rule | 尺寸敏感终端区域不得使用位移动画 | 页面级进入动画必须排除 Terminal 核心容器；`.terminal-host`、`.xterm` 和 viewport 不应使用 transform 动画或改变关键 box model。普通页面可使用轻位移，Artifacts/Workflow 仅淡入，Terminal 页面关闭进入动画。 | `theme.css`、`theme.test.ts`、现有 Terminal 测试通过 | Terminal UI 规则 / 交互动效约束 |
| pitfall | Windows PowerShell 读取中文 JSON 必须显式 UTF-8 | Windows PowerShell 默认编码可能把无 BOM 的 UTF-8 中文 JSON 误解码并造成 `ConvertFrom-Json` 假性语法错误；对 Harness 中文证据文件应使用 `Get-Content -Encoding UTF8`。 | 本 Run 证据校验首次失败，显式 UTF-8 后同一文件成功解析 | Windows 开发环境 / Harness 证据处理 |

## 不建议沉淀的内容

- 蓝紫品牌色、具体阴影数值和 1180/900/680px 断点：属于当前产品视觉实现细节，尚不足以成为跨项目规则。
- Vite 当前输出的具体资源大小和构建耗时：是一次性构建结果，不是长期知识。
- 用户已在 context-pack 明确的“统一按钮、卡片、动画”目标：属于原始需求，不是增量工程知识。
- 未进行真实 Electron 逐页人工视觉巡检的风险：应保留在验收报告，不应沉淀为已验证结论。

## 待用户确认

- 是否将“兼容式主题层”和“CSS 源码契约测试”写入共享前端工程知识。
- 是否将 Terminal 动画安全约束提升为 `.harness` 的稳定前端规则。
- 是否将 Windows PowerShell UTF-8 读取要求加入 Windows 开发环境排障指南。

> 本草稿未自动写入长期知识库，等待人工审核。
