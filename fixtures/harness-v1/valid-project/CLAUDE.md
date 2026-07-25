<!-- HARNESS ROOT GUIDE START -->
# Claude Code Harness 入口

本文件是 `AGENTS.md` 的 Claude Code 版本。真正的流程事实来源是 `.harness/`。

## 使用规则

- 非简单任务必须走 harness。
- 不自行覆盖 `intent` / `risk`。
- 不跳过 dispatcher 指定节点。
- 阶段产物写入当前 `state.phase_dir`。
- 门禁和状态变更必须有文件记录。

请优先读取 `.harness/state.json`、`.harness/workflow.yaml` 和 `.harness/agents/dispatcher.md`。
<!-- HARNESS ROOT GUIDE END -->
