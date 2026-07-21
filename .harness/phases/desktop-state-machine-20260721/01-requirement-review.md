# 需求评审 — Harness Desktop State Machine (Phase 2)

节点：REQUIREMENT_REVIEW　角色：requirement-analyst
上游：M1 Run（`desktop-foundation-20260721`）、`00-intake.md`、`00-context-pack.md`
门禁：G1_REQUIREMENTS

## 目标

在 M1 Runtime（FastAPI + Pydantic contracts）上实现五个核心子系统，构成 Harness Desktop 的状态机内核：
1. **Protocol Adapter** — 加载、校验、序列化 `.harness` v1.0
2. **Atomic State Store** — 带锁/版本/原子替换/快照的安全写入
3. **Workflow Compiler** — 合并系统规则、编译线性路由、引用校验
4. **Dispatcher + Run Service** — 节点路由、Run 生命周期、确认机制
5. **Gate Engine + Artifact Service** — 确定性门禁、权限、重试、产物安全读取

## 范围

| Task | 核心交付 | 关键文件 |
|---|---|---|
| 2.1 Protocol | Pydantic 模型组 + YAML/JSON loader + validator + diagnostics | `runtime/protocol/` |
| 2.2 Projects | SQLite schema + project CRUD + Renderer 项目列表 | `runtime/projects/` + `apps/renderer/` |
| 2.3 State Store | 原子写 + 项目锁 + revision check + snapshot + 故障注入测试 | `runtime/persistence/` |
| 3.1 Compiler | SYSTEM_MINIMUM_RULES + 线性编译 + simulate() + diag | `runtime/workflow/compiler.py` |
| 3.2 Run Service | create/list/switch/pause/resume + 路由冻结 | `runtime/runs/` |
| 3.3 Dispatcher | next node 选择 + confirmation 人工确认 + CHANGE_REQUEST 迁移 | `runtime/workflow/dispatcher.py` |
| 3.4 Gate Engine | 确定性检查 + G3-G8 权限 + retry→BLOCKED + WAIVED 校验 | `runtime/gates/` |
| 3.5 Artifacts | 安全路径读取 + SHA-256 + 文件监听 + Markdown/JSON 预览 | `runtime/artifacts/` |

## 非目标

- Workflow Studio UI（Phase 4）
- Codex Adapter / Approval Service / Recovery（Phase 5-6）

## 验收标准（可观察）

- [ ] **标准 1（Protocol Adapter）**：给定 M1 的 9 个 fixture（1 valid + 8 invalid），Protocol Adapter 的 `load_project()` 应使 valid 通过、invalid 返回 diagnostics（error code + JSON Pointer）。新增测试覆盖 YAML 语法错误、Schema 错误、symlink/junction 逃逸。
  - 验证：`python -m pytest runtime/tests/protocol/ -v` 全部通过
- [ ] **标准 2（Project Registry）**：给定一个本地 `.harness` 项目路径，`project.import` 应验证协议健康度、注册到 SQLite、返回 ProjectSummary。非 Harness 目录应拒绝或提示模板初始化。协议不兼容项目返回 readonly。
  - 验证：`python -m pytest runtime/tests/projects/ -v` + Renderer 项目列表组件测试
- [ ] **标准 3（Atomic State Store）**：故障注入测试覆盖：replace 失败保留旧文件、临时文件清理、并发 revision 冲突返回 `REVISION_CONFLICT`、snapshot 失败不报成功。锁超时返回 `PROJECT_LOCK_TIMEOUT`。
  - 验证：`python -m pytest runtime/tests/persistence/test_state_store.py -v` 含故障注入用例
- [ ] **标准 4（Workflow Compiler）**：有效 workflow 编译成功；删除系统最低节点的草稿编译失败；DAG/并行/循环/动态表达式被拒绝；`simulate(intent, risk)` 返回线性路径与自动加入节点理由。
  - 验证：`python -m pytest runtime/tests/workflow/test_compiler.py -v`
- [ ] **标准 5（Run Service + Dispatcher）**：`create_run` 不接受自动 intent/risk 分类参数；run_id 含空格/路径/盘符的创建在 mkdir 前失败；workflow 修改不影响已有 Run；Dispatcher 只返回 required 中第一个未完成节点；confirmation node 未人工确认时不能完成。
  - 验证：`python -m pytest runtime/tests/runs/ -v` + `runtime/tests/workflow/test_dispatcher.py -v`
- [ ] **标准 6（Gate Engine）**：G3-G8 非 verifier 调用返回 `GATE_PERMISSION_DENIED`；WAIVED 缺 scope/reason/owner 不接受；FAIL 增 retry_count 并按 gate_to_node 回退；第三次失败→BLOCKED；自定义 Gate 只做存在/非空检查。
  - 验证：`python -m pytest runtime/tests/gates/test_gate_engine.py -v`
- [ ] **标准 7（Artifact Service）**：只读 phase_dir 与项目根；返回类型/大小/mtime/SHA-256；大文件分页；文件变化触发 debounce 事件。
  - 验证：`python -m pytest runtime/tests/artifacts/ -v`

## 开放问题

| ID | 问题 | 建议 |
|---|---|---|
| OQ-1 | SQLite 路径：开发阶段放项目根 vs AppData | 开发阶段放项目根 `harness-desktop.db`（`.gitignore`），Phase 6 迁 AppData |
| OQ-2 | YAML `!include`/anchor/alias 支持 | 首发不支持，只解析纯 YAML/JSON |
| OQ-3 | CHANGE_REQUEST diff UI | M2 先做 API + 测试，UI 留 Phase 4 |

## G1 门禁预评

- required_artifacts：`01-requirement-review.md` ✓
- pass_conditions：目标已说明 ✓；验收标准可观察（7 条，各带验证命令）✓；开放问题已记录（3 条）✓
- 结论：**G1_REQUIREMENTS → PASS**（待人工确认）
