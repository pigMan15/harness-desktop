# 方案设计

## 现状上下文

- `doc/desktop-architecture.md` 是完整首发架构方案，包含 `.harness` v1.0 兼容、Runtime/Renderer/Main 边界、Workflow Studio、执行器、审批、恢复、知识、Windows 发布和首发验收标准。
- `doc/desktop-implementation-plan.md` 是任务级实施计划，但 checkbox 当前基本未勾选，可能与 README 中“M1-M5 已交付、176 pytest tests”的表述不一致。
- 当前仓库已经存在 Runtime、Electron、Renderer、Contracts、测试和打包脚本，说明实现并非空壳；但是否满足架构第 20 节全部验收，需要逐项证据核对。

## 推荐方案

1. 建立设计承诺清单：
   - 架构第 20 节首发验收标准。
   - 实施计划 Phase/Task 的关键交付项。
   - README 中对当前完成状态和测试数量的声明。
2. 建立实现证据索引：
   - 文件存在性：`rg --files`。
   - 精确标识符搜索：关键类、函数、页面、测试名、脚本名。
   - 重点文件局部阅读，避免无边界预读。
   - 验证命令：优先使用已有聚焦测试，再运行总入口检查。
3. 输出差异清单，分类为：
   - `OK`：实现和文档一致，有文件/测试证据。
   - `DOC_STALE`：实现存在但文档计划状态滞后或声明不准确。
   - `IMPLEMENTATION_GAP`：文档要求存在，但实现或测试缺失。
   - `UNVERIFIED`：仓库内无法证明，例如 Windows VM 安装、代码签名、真实 Codex 环境。
4. 完善策略：
   - 优先修复 `DOC_STALE` 和误导性完成声明。
   - 对小范围 `IMPLEMENTATION_GAP` 可补实现或补测试。
   - 对大型缺口记录为剩余风险，不伪造成完成。

## 受影响文件/模块

- 文档：`doc/desktop-architecture.md`, `doc/desktop-implementation-plan.md`, `README.md`, `README_en.md`, `CHANGELOG.md`
- Phase 产物：`.harness/phases/doc-implementation-alignment-20260722/*`
- 可能涉及源码：`runtime/src/harness_runtime/**`, `apps/desktop/src/**`, `apps/renderer/src/**`, `packages/contracts/src/**`
- 可能涉及测试：`runtime/tests/**`, `apps/desktop/tests/**`, `packages/contracts/tests/**`

## 数据流

```text
doc 设计承诺
  -> 搜索/读取实现证据
  -> 差异清单
  -> 文档或实现修复
  -> 编译/测试/等价检查
  -> evidence + acceptance report
```

## 兼容性

- 不改变 `.harness` v1.0 协议，不修改 active run 路由语义。
- 如修改 README/计划文档，仅调整事实表达和追踪状态，不影响运行时行为。
- 如修改源码，保持现有公共接口兼容，优先补测试覆盖。

## 回滚

- 文档修复可通过 git diff 定位并回滚对应文件。
- 源码修复若导致验证失败，回退到 DEVELOPMENT 重新处理；不把 G3/G4 标记为 PASS。
- 大型未完成项不在本 run 内强行实现，避免半成品扩大风险。

## 被拒绝的替代方案

- 全量实现所有架构未来项：范围过大，且会混入发布、安装、签名、E2E 等高风险工作。
- 只更新 README 宣称全部完成：缺少证据，会让文档继续误导。
- 仅输出口头清单不落盘：违反 harness 证据规则。
