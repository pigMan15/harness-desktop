# 知识沉淀草稿

## 来源

- RunId: `doc-implementation-alignment-20260722`
- Intent: `FEATURE`
- Risk: `MEDIUM`
- Phase dir: `.harness/phases/doc-implementation-alignment-20260722`
- 原始 PRD / context-pack: `00-context-pack.md`

## 候选知识

| 类型 | 标题 | 相对 PRD 的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- |
| pitfall | 文档核对不能只看计划 checkbox | 本 run 发现实施计划 checkbox 全未勾选，但仓库已有大量实现和测试；应增加“当前核对状态”而不是机械勾选。 | `20-doc-implementation-diff.md` D11，`doc/desktop-implementation-plan.md` 当前实现核对状态 | `.harness/knowledge/pitfalls/doc-implementation-alignment.md` |
| pitfall | TypeScript workspace 测试可能被非 JS cache 目录干扰 | `pnpm test` 通过 Vitest workspace 扫描到 `runtime/.pytest_cache` 并 EPERM，包级测试可作为更聚焦验证。 | `13-unit-test.md`, `15-evidence.json` commands | `.harness/knowledge/pitfalls/vitest-workspace-scan.md` |
| rule | 发布级声明必须区分源码存在与外部验证 | Windows VM、签名、更新源、真实 Codex smoke 不能仅凭脚本或适配器存在声明完成。 | `20-doc-implementation-diff.md` D18，`README.md` 验证边界 | `.harness/knowledge/rules/release-evidence-boundary.md` |
| case | README_en 从旧产品文档漂移到当前项目 | 英文 README 仍描述 Bridle CLI，是典型多语言文档漂移；本 run 将其改为 Harness Desktop。 | `20-doc-implementation-diff.md` D10，`README_en.md` | `.harness/knowledge/cases/readme-language-drift.md` |

## 不建议沉淀的内容

- Harness Desktop 的总体架构：PRD/架构文档已明确，不是本 run 新增知识。
- 本次所有命令完整输出：属于一次性 evidence，不适合作为长期知识。
- `README` 中具体测试数量是否为 176：当前环境未验证，不沉淀为事实。
- 工作区已有非本任务改动：没有分析归因，不沉淀。

## 待用户确认

- 是否将上述候选知识写入长期知识库。
- 是否为 Vitest workspace 扫描 `.pytest_cache` 问题单独创建后续修复 run。
