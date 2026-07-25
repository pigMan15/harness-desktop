# 验收报告

## 范围

- 修复 Terminal 页面空闲时外层滚动范围和终端区域持续纵向增长。
- 让应用 Grid、Terminal Grid 和 xterm host 使用可收缩、受 viewport 约束的高度。
- 对 ResizeObserver 产生的 PTY resize 按实际 cols/rows 去重。
- 不改变 Runtime、node-pty、TerminalManager、Run 或 Workflow 协议。

## 验收映射

| 标准 | 结果 | 证据 |
| --- | --- | --- |
| AC-01 桌面视口空闲高度稳定 | PASS | 系统 Chrome 场景连续采样 8 次 page、host、xterm viewport，三项最大差值均不超过 1 CSS px。 |
| AC-02 窄视口不重叠且滚动稳定 | PARTIAL | CSS 使用 `min-height: 0` 和 `minmax(0, 1fr)`，无固定 320px 反馈；未单独执行第二个窄视口自动场景。 |
| AC-03 resize 后 fit 且相同行列不重复 IPC | PASS | `lastTerminalSize` 行列去重实现与 Renderer 源契约测试通过。 |
| AC-04 Terminal 既有能力不回归 | PASS | Renderer 5 个文件、17 项单元测试全部通过；PTY/Main 协议未修改。 |
| AC-05 typecheck、单测和浏览器场景 | PASS（含豁免） | 单测和浏览器场景通过；typecheck/build 按用户指令在 G3 明确 WAIVED。 |

## 变更摘要

- `.workspace-shell`、`.page-scroll`、`.terminal-page` 和 `.terminal-host` 增加明确的收缩边界。
- 终端 Grid 主行由 `minmax(320px, 1fr)` 改为 `minmax(0, 1fr)`，host 高度完全由有界 Grid 决定。
- ResizeObserver fit 后仅在 cols/rows 变化时同步 Main，避免空闲重复 IPC。
- 新增实现后单元契约和真实浏览器高度采样场景。

## 验证汇总

- G3_COMPILE：`WAIVED`，用户明确要求跳过编译，没有 typecheck/build 结果。
- G4_UNIT_TEST：`PASS`，17/17。
- 聚焦浏览器场景：`PASS`，1/1；首次环境失败和一次包装命令挂起均完整记录在 `15-evidence.json`。
- G5/G7：当前 `BUG_FIX / MEDIUM` 路线不要求，状态为 `NOT_REQUIRED`。

## 剩余风险

- 未执行 TypeScript typecheck 或生产 Vite build，可能存在编译路径风险。
- 没有执行完整 Playwright 集合；仅本次高度稳定性场景通过。
- 窄视口由同一 CSS 约束覆盖，但没有单独的自动化采样结果。

## 结论

- 核心用户问题已有直接浏览器证据证明修复，范围与回滚清晰。
- 在保留用户授权的 G3 豁免和上述剩余风险前提下，建议 G8 PASS。
