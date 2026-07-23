# Dispatcher 决策

- 意图：QUERY
- 风险：NA
- 当前节点：INTAKE
- 下一节点：KNOWLEDGE_PROMOTION
- 下一角色：knowledge-keeper
- 必需产物：`.harness/phases/feature-audit-codex-integration-20260724/19-knowledge-promotion.md`
- 必需规则/上下文：只读核对当前 Runtime、Desktop、Renderer、Codex executor、workflow/run 与既有测试证据；不修改业务源码，不运行构建或部署。
- 原因：用户要求分析当前整体功能完成度、Codex 对接不可用原因，并参考主流开源 agent 工具给出完善路线。

## 分析范围

- Desktop UI 到 preload、IPC、Runtime JSON-RPC 的主链路。
- Project、Run、Workflow、Gate、Artifact、Execution、Recovery、Knowledge 等功能的真实实现状态。
- Codex executor 的探测、启动、会话、事件、审批、取消与错误呈现。
- 打包环境中 Codex CLI 的发现、认证、工作目录、环境变量与生命周期。
- 与主流开源 agent 工具在 provider adapter、capability probe、session/event、approval、workspace sandbox 和 observability 方面的对比。

## 输出要求

- 用证据区分已完成、部分完成、仅有接口和未实现。
- 明确 Codex 当前“用不了”的直接根因与架构缺口。
- 给出按 P0/P1/P2 排序的完善清单和建议验收标准。
