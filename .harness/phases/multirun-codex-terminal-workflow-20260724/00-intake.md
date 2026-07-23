# Dispatcher 决策

- 意图：`QUERY`
- 风险：`NA`
- 当前节点：`INTAKE`
- 下一节点：`KNOWLEDGE_PROMOTION`
- 下一角色：`knowledge-keeper`
- 必需产物：`.harness/phases/multirun-codex-terminal-workflow-20260724/19-knowledge-promotion.md`
- 必需规则/上下文：读取当前项目设计文档、实现审计和上一 Run 产物，输出一份可作为本期交付范围的完整方案。
- 原因：用户要求把多 Run、Codex 终端和 Workflow 优化合并到同一期完成，并输出新的 Harness 产物；本 Run 只产出方案，不修改业务源码、不运行构建或测试。

## 本期范围约束

本期方案覆盖以下完整闭环，不把核心能力拆到后续版本：

1. 多 Run 创建、切换、并行执行和独立终端绑定。
2. Codex 真实 CLI 的路径发现、交互式 PTY 终端、启动、输入、停止和重启。
3. 项目/Run/worktree/terminal/session 的隔离和状态管理。
4. Workflow Studio 的自定义节点、路线、Gate、规则、导入导出、校验、diff 和版本能力。
5. Codex 终端工作完成后的人工确认、artifact 校验、节点推进和 Gate 衔接。
6. 打包环境下的运行、诊断、测试和验收标准。
