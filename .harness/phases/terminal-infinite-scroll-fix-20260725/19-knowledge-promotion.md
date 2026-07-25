# 知识沉淀草稿

## 来源

- RunId：`terminal-infinite-scroll-fix-20260725`
- Intent：`BUG_FIX`
- Risk：`MEDIUM`
- Phase dir：`.harness/phases/terminal-infinite-scroll-fix-20260725`
- 原始输入：`00-intake.md`、`01-requirement-review.md`；本路线没有 CONTEXT_PACK。

## 候选知识

| 类型 | 优先级 | 领域 | 置信度 | 标题 | 相对原始输入的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pattern | 高 | Renderer 布局 | 高 | 全高度终端的每层 Grid 子项都必须可收缩 | 仅给终端 `height: 100%` 不足；从 viewport Grid 到 scroll 容器、页面 Grid、terminal host 都需要 `min-height: 0`，主终端行使用 `minmax(0, 1fr)`，否则 xterm 内容尺寸会反向扩大父级滚动范围。 | Chrome 连续 8 次 page/host/viewport 高度差不超过 1px；CSS 修复前后代码差异。 | `doc/desktop-architecture.md` Terminal UI 布局约束。 |
| rule | 高 | xterm 生命周期 | 高 | FitAddon resize 必须按 cols/rows 去重后再发 IPC | ResizeObserver 回调不等于终端行列变化；fit 会改写 xterm 内部 DOM，相同行列重复同步会放大反馈和无效 Main IPC。 | `TerminalPage.tsx` 的 `lastTerminalSize`；Renderer 契约测试通过。 | Terminal renderer 开发规则或组件注释。 |
| pitfall | 中 | Playwright 环境 | 高 | `reuseExistingServer` 可能复用端口存活但 esbuild 已死亡的 Vite | HTTP 端口存活不证明 transform service 可用；测试 overlay 明确显示 `The service is no longer running`，精确结束旧 Vite 后聚焦场景通过。 | `15-evidence.json` 首次失败、PID/端口诊断与最终 1/1 PASS。 | `docs/troubleshooting.md` 本地 E2E 章节。 |

## 不建议沉淀的内容

- 具体 PID、端口连接和启动时间：属于本机一次性诊断数据。
- 用户本次跳过编译：属于当前 Run 的授权豁免，不是默认工程规则。
- 失败命令中的 pnpm 参数分隔细节：已保留证据，但单次误用不足以提升为长期规则。

## 待用户确认

- 是否将“全高度 xterm 的逐层 `min-height: 0` + `minmax(0, 1fr)`”加入 Desktop UI 开发规则。
- 是否将 cols/rows 去重作为所有 Terminal ResizeObserver 实现的硬性规则。
- 本草稿未自动写入长期知识库。
