# Dispatcher 决策 — INTAKE (Phase 2)

- **意图**：FEATURE（继续构建 Harness Desktop 核心状态机）
- **风险**：HIGH
- **当前节点**：INTAKE
- **下一节点**：CONTEXT_PACK
- **下一角色**：requirement-analyst
- **必需产物**：`00-context-pack.md`
- **必需规则/上下文**：requirement-analyst 角色文件、M1 Run `desktop-foundation-20260721` 全部产物
- **原因**：用户要求继续开发。M1（Phase 0+1）已完成：仓库骨架 + 契约 + Runtime 握手 + Electron 壳。本 Run 进入实施计划 Phase 2 + 3.1-3.5：协议适配器、原子状态存储、Dispatcher、Gate Engine、Artifact Service — Harness Desktop 核心状态机。路由已由 `bridle new` 冻结为 22 节点 FEATURE/HIGH 线性路径。

## 任务摘要

### 目标
在 M1 代码基上实现 Harness Desktop 核心状态机：`.harness` v1.0 Protocol Adapter（加载/校验/序列化）、AtomicStateStore（锁/版本/原子替换/快照）、Workflow Compiler（系统最低规则合并/路由编译/模拟）、Run Service（创建/切换/暂停/恢复）、Dispatcher（节点选择/确认/路由迁移）、Gate Engine（确定性检查/权限/重试/阻塞）、Artifact Service（安全路径/预览/哈希）。

### 范围（本 Run = Phase 2 + §3.1-3.5）

| Task | 内容 | M1 依赖 |
|---|---|---|
| 2.1 Protocol Adapter | `HarnessState`/`WorkflowDefinition`/`NodeDefinition`/`GateDefinition` Pydantic 模型；YAML/JSON 加载；Schema 校验；路径安全（symlink/junction 拒绝）；diagnostics | `runtime/contracts/models.py`（扩展 Pydantic） |
| 2.2 Project Registry | SQLite 初始化 + migration；项目导入/校验/初始化/取消注册；Renderer 项目列表 UI | `runtime/api/`（扩展端点） |
| 2.3 Atomic State Store | 原子写（tmp→flush→fsync→os.replace）；项目锁；revision 冲突检测；状态快照；故障注入测试 | 无（新增 `runtime/persistence/`） |
| 3.1 Workflow Compiler | 系统最低规则（不可删除）；节点/角色/Gate/路由引用检查；线性路由编译；simulate(intent,risk)；hard_rules 并集 | `fixtures/harness-v1/`（契约测试） |
| 3.2 Run Service | create_run(list/intent/risk)；路由冻结；list/switch/pause/resume；workflow 修改不影响活动 Run | Protocol Adapter + State Store |
| 3.3 Dispatcher | 第一个未完成 required node；确认节点人工确认；CHANGE_REQUEST 路由迁移 + diff | Run Service + Workflow Compiler |
| 3.4 Gate Engine | G1-G8 确定性检查；G3-G8 权限；WAIVED scope/reason/owner；retry×2→BLOCKED；failure_recovery 回退 | State Store + Protocol Adapter |
| 3.5 Artifact Service | 安全路径读取；内容类型/大小/mtime/SHA-256；文件监听 debounce；Markdown/JSON 分页 | State Store（不写） |

### 非目标
- Workflow Studio 可视化编辑（Phase 4）
- Codex Adapter / Approval Service（Phase 5）
- Recovery / Knowledge / 打包（Phase 6）

### 关键架构约束
- **项目协议不重写**：不引入新项目文件；`state.json`/`phase_dir`/`runs/<id>/state.json` 权威边界不变
- **SQLite 仅为派生数据**：删除后可从项目重建，不参与状态裁决
- **系统最低规则不可删除**：`effective_rules = system_minimum ∪ project_hard`
- **v1 线性限制**：拒绝 DAG/并行/循环/动态表达式
- **安全模型持续**：路径 canonicalize + 拒绝 symlink/junction 逃逸；run_id/Node/Gate/文件名白名单

### 参考文档
- M1 Run：`.harness/phases/desktop-foundation-20260721/`（全部 21 产物）
- 架构方案：`doc/desktop-architecture.md`（§5 状态约束、§8.3 Runtime、§9 编译、§10 状态事务）
- 实施计划：`doc/desktop-implementation-plan.md`（Phase 2-3, Task 2.1-3.5）
- M1 代码基：`runtime/src/harness_runtime/`（api/ + contracts/）
