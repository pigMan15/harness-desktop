# 方案设计 — Harness Desktop State Machine (Phase 2)

节点：SOLUTION_DESIGN　角色：tech-architect　产物：`03-solution-design.md`
上游：M1 代码基、M1 `03-solution-design.md`（ADR-1/2/3 继承）
门禁：G2_DESIGN（03+06 齐全后评估）

## 现状上下文

M1 已交付：FastAPI app（`/health` + token auth）、Pydantic contracts（8 模型类）、fixture 测试（29 cases）。Phase 2 在 M1 Runtime 上新增 5 个子系统，全部为 Python 实现（纯逻辑，不涉及 Electron/Renderer 变更除了项目列表 UI）。

## 子系统设计

### 1. Protocol Adapter（`runtime/protocol/`）

**数据模型**（Pydantic v2，扩展 M1 contracts）：

```python
# models.py
class HarnessState(BaseModel):
    schema_version: Literal["1.0"]
    run_id: str  # regex ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$
    status: str  # enum
    intent: str  # enum
    risk: str    # enum
    current_node: str
    next_role: str
    phase_dir: str
    required_nodes: list[str]
    completed_nodes: list[str]
    blocked_by: list[str]
    artifacts: dict[str, str]
    gates: dict[str, str]  # gate_id → status
    retry_counts: dict[str, int]
    last_updated: Optional[str]
    notes: str

class NodeDefinition(BaseModel):
    id: str
    role: str
    artifact: str
    gates: list[str] = []

class WorkflowDefinition(BaseModel):
    schema_version: str
    artifact_root: str
    nodes: list[NodeDefinition]
    routes: dict[str, dict[str, list[str]]]
    hard_rules: dict
    failure_recovery: dict
    gate_meanings: dict[str, str]
```

**Loader**：`load_state(path) → HarnessState`、`load_workflow(path) → WorkflowDefinition`。YAML 用 `yaml.safe_load`，JSON 用 `json.load`。路径用 `Path.resolve()` + `relative_to()` 防逃逸。**Validator**：17 条规则从 M1 `validate_fixture()` 提取并增强（新增：symlink 检测、junction 检测、retry_counts 上限）。

### 2. Atomic State Store（`runtime/persistence/`）

**数据库**（SQLite，stdlib `sqlite3`）：5 表 — `projects`（id/name/path/health/created）、`workflow_versions`（project_id/hash/yaml/author/time）、`executor_sessions`（project_id/run_id/pid/start_time/status）、`audit_events`（project_id/run_id/node/gate/event/time）、`request_dedup`（request_id/response/time）。

**原子写流程**（架构 §10）：
```
1. 接收 command + expected_revision
2. 获取项目锁（file lock / named mutex，超时 → PROJECT_LOCK_TIMEOUT）
3. 重新读取 state.json，计算 hash，与 expected_revision 比较
4. 若冲突 → 返回 REVISION_CONFLICT（不 last-write-wins）
5. 执行业务规则 + Schema 校验
6. 写入 phase_dir/state.json.tmp
7. flush + os.fsync
8. os.replace(tmp, state.json)  # 原子替换
9. 复制到 runs/<run-id>/state.json
10. 提交 SQLite audit 记录
11. 释放锁
```

**故障注入测试**：mock `os.replace` 抛异常 → 验证旧文件完整；mock `os.fsync` 失败 → 验证不报告成功；并发两个 writer → 验证 revision conflict。

### 3. Workflow Compiler（`runtime/workflow/`）

**系统最低规则**（`system_policy.py`，不可删除）：
```python
SYSTEM_MINIMUM_RULES = {
    "code_changed_requires": ["COMPILE", "UNIT_TEST", "EVIDENCE_CAPTURE"],
    "high_risk_requires": ["REQUIREMENT_CONFIRMATION", "SOLUTION_CONFIRMATION",
                           "PRE_MORTEM", "ACCEPTANCE_CONFIRMATION"],
    "high_or_deployment_requires": ["PRERELEASE_DEPLOYMENT", "INTERFACE_TEST"],
    "immutable": ["intent", "risk"],  # 只能用户指定，不得覆盖
    "verifier_only_gates": ["G3_COMPILE", "G4_UNIT_TEST", "G5_ATDD",
                            "G6_EVIDENCE", "G7_PRERELEASE", "G8_ACCEPTANCE"],
}
```

**编译**：`compile(workflow, intent, risk) → CompiledRoute`：
1. 节点唯一性 + 角色存在 + Gate 引用 + artifact 安全 + failure_recovery 无环
2. 合并 `effective_rules = SYSTEM_MINIMUM ∪ project_hard`
3. 校验路由满足 effective_rules（缺少必备节点 → diag error）
4. v1 模式拒绝 DAG/并行/循环/动态表达式
5. 返回 `required_nodes` 列表（线性顺序）

**simulate(intent, risk)**：运行编译但不写文件，返回路径 + 每个自动加入节点的理由。

### 4. Run Service + Dispatcher（`runtime/runs/` + `runtime/workflow/dispatcher.py`）

**Run Service**：
- `create_run(project_id, intent, risk)` — 不接受自动分类参数；调用 compiler 获取 required_nodes；原子写 state；快照
- `list_runs(project_id)` → `list[RunSummary]`
- `switch_run(project_id, run_id)` → 更新 state.json 为对应快照
- `pause_run` / `resume_run` — 只设标志，不跳节点
- run_id 校验：正则 + 无路径遍历 + 无盘符 + 非已存在 run_id → 全部在 mkdir 前失败

**Dispatcher**：
- `next_node(state)` → `required_nodes` 中第一个不在 `completed_nodes` 的节点
- `confirm(node_id, decision, comment)` — 仅 confirmation 节点可确认；记录确认人/决定/意见/时间到 phase artifact
- `change_request(state, new_route)` — 展示 route diff；保留已完成节点一致性；用户确认后更新 `required_nodes`；保存快照

### 5. Gate Engine + Artifact Service（`runtime/gates/` + `runtime/artifacts/`）

**Gate Engine**：
- `evaluate(gate_id, state, caller_role)` → PASS/FAIL/WAIVED/BLOCKED
- G3-G8 非 verifier → `GATE_PERMISSION_DENIED`
- 确定性检查：artifact 存在/普通文件/非空/路径在 phase_dir 内
- G6 额外：合法 JSON + 9 字段
- WAIVED 额外：scope/reason/owner 必须
- FAIL → `retry_counts[gate] += 1`；若 ≤2 → 按 `gate_to_node` 回退；若 >2 → BLOCKED
- PASS → `retry_counts[gate]` 清零
- 自定义 Gate 首发只做存在/非空检查

**Artifact Service**：
- `read_artifact(project_root, phase_dir, filename)` → 校验路径在 project_root 或 phase_dir 内 → 返回内容/类型/大小/mtime/SHA-256
- `list_artifacts(phase_dir)` → `list[ArtifactInfo]`
- `watch_artifacts(phase_dir, callback)` → watchdog 监听 debounce 300ms → `ArtifactChanged` 事件
- Markdown > 1MB 截断 + 分页；JSON > 5MB 拒绝

## API 扩展（M1 FastAPI 新增端点）

```
project.list / project.import / project.validate
workflow.get / workflow.compile / workflow.apply / workflow.simulate
run.list / run.create / run.switch
node.start / node.confirm
gate.list / gate.evaluate / gate.waive
artifact.list / artifact.read / artifact.hash
```

## 文件结构（本 Run 新增）

```
runtime/src/harness_runtime/
  protocol/          # Task 2.1 — models, loader, validator
  projects/          # Task 2.2 — service
  persistence/       # Task 2.3 — database, atomic_files, project_lock, state_store, audit
  workflow/          # Task 3.1+3.3 — compiler, system_policy, diagnostics, dispatcher
  runs/              # Task 3.2 — service, identifiers
  gates/             # Task 3.4 — engine, evidence, permissions
  artifacts/         # Task 3.5 — service, watcher
runtime/tests/
  protocol/test_loader_validator.py
  projects/test_project_service.py
  persistence/test_state_store.py
  workflow/test_compiler.py + test_dispatcher.py
  runs/test_run_service.py
  gates/test_gate_engine.py
  artifacts/test_artifact_service.py
```

## 回滚

- Protocol Adapter 校验过严 → 降级为 M1 `validate_fixture()` 宽松模式，逐步收紧
- 原子写故障 → 跳过 fsync 降级为非原子写（写临时状态日志）
- Compiler 拒绝合法编排 → 增加 rule override 豁免机制（用户确认）
- SQLite 损坏 → 删除 `.db` 从项目重建（OQ-1 保证可重建性）

## 被拒绝的替代方案

| 方案 | 原因 |
|---|---|
| ORM（SQLAlchemy） | 5 表 + 简单 CRUD，不必引入 ORM 复杂度；stdlib sqlite3 够用 |
| aiosqlite 异步 | M1 Runtime 用同步 uvicorn；async 收益在单用户 desktop 场景有限 |
| 文件锁用 `fcntl` | Windows 不支持；用 `msvcrt` 或文件锁文件替代 |
| Protocol Adapter 用 dataclass 而非 Pydantic | M1 contracts 已用 Pydantic v2，保持一致 + 免费获得校验 |
