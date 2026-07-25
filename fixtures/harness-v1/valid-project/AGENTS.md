<!-- HARNESS ROOT GUIDE START -->
# 项目 Harness 入口

本项目使用 `.harness/` 作为 AI Coding 工程化流程的唯一事实来源。

## 硬性约束

1. 涉及源码变更、构建、测试、部署或问题排查的任务必须经过 harness。
2. `intent` 和 `risk` 以 `.harness/state.json` 或用户创建 run 时的选择为准。
3. 不得跳过 dispatcher 路由出的必需节点。
4. 阶段产物必须写入当前 `state.phase_dir`。
5. 门禁结果必须由对应验证角色记录，不能口头替代。

## 标准入口

每次开始非简单任务时，先读取：

- `.harness/state.json`
- `.harness/workflow.yaml`
- `.harness/agents/dispatcher.md`

然后按 dispatcher 给出的节点和角色继续。
<!-- HARNESS ROOT GUIDE END -->
