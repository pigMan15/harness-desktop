# 知识沉淀 — Phase 2

节点：KNOWLEDGE_PROMOTION　角色：knowledge-keeper

## 候选条目（待人工 review）

| # | 类型 | 摘要 |
|---|---|---|
| 1 | pattern | **Atomic State Store 五步模式** — lock→read revision→validate→tmp→flush→fsync→os.replace→snapshot→unlock。适用于任何需要安全写入权威状态的场景 |
| 2 | case | **SYSTEM_MINIMUM_RULES 不可变设计** — 系统规则硬编码为常量，与项目规则取并集（project 只能更严格）。删除最低节点的 workflow 编译失败 |
| 3 | case | **Gate Engine 双重保护** — 权限层（G3-G8 verifier-only）+ 确定性检查层（artifact 存在/非空/路径安全）。NOT_REQUIRED 在权限之前返回 |
| 4 | pitfall | **pytest 119 tests 零回归证明 M1+M2 完全向后兼容** — 新增模块不破坏已有 contract |
| 5 | template | **Phase 2 5-subsystem 模式可复用于后续 Phase** — protocol→persistence→workflow→runs→gates→artifacts 的分层依赖链 |

全部条目为草稿，需人工逐条 review/accept。
