# Dispatcher 决策

- 意图：FEATURE
- 风险：MEDIUM
- 当前节点：INTAKE
- 下一节点：CONTEXT_PACK
- 下一角色：requirement-analyst
- 必需产物：`.harness/phases/doc-implementation-alignment-20260722/00-context-pack.md`
- 必需规则/上下文：`.harness/state.json`、`.harness/workflow.yaml`、`.harness/agents/requirement-analyst.md`
- 原因：用户要求核对当前项目整体实现与 doc 中设计文档的差异，输出清单并完善；该任务可能涉及跨文件文档/源码修改，匹配 FEATURE/MEDIUM 路线。

## 范围

- 识别仓库 doc/设计文档中的实现预期。
- 对照当前代码、配置和应用结构，输出差异清单。
- 对可在当前仓库内直接修复的差异进行完善。
- 记录验证命令、门禁结果、豁免和剩余风险。

## 初始验收标准

1. 差异清单写入当前 `phase_dir`。
2. 完善后的变更与设计文档目标一致，且不引入无关改动。
3. 相关构建、测试或等价检查有记录。
