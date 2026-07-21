# 实施计划 — Phase 2 State Machine

节点：IMPLEMENTATION_PLAN　角色：plan-generator　产物：`06-implementation-plan.md`

## 假设

- M1 代码基（FastAPI + Pydantic contracts + fixture tests）完整可用
- Python 3.13 环境已配置（`pip install -e runtime[dev]` 可用）
- `pyyaml` 按需安装（Protocol Adapter YAML 解析）
- SQLite 为 Python stdlib（无需额外安装）
- TDD：每个 Task 先写失败测试 → 最小实现 → 全量回归

## Task 列表

### Task 2.1：Protocol Adapter（4 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../protocol/__init__.py` | 空 |
| `runtime/.../protocol/models.py` | `HarnessState`/`WorkflowDefinition`/`NodeDefinition`/`GateDefinition` Pydantic 模型；字段级 validator（run_id 正则、intent/risk 枚举、phase_dir 安全） |
| `runtime/.../protocol/loader.py` | `load_state(path)`/`load_workflow(path)` — YAML safe_load + JSON；路径解析 `Path.resolve()` + `relative_to()` |
| `runtime/.../protocol/validator.py` | `validate_state(state)`/`validate_workflow(wf)` → `list[WorkflowDiagnostic]`；17 条规则从 M1 `validate_fixture()` 提取 |
| `runtime/tests/protocol/test_loader_validator.py` | 参数化：M1 9 fixtures 回归 + YAML 语法错误/JSON decode 错误/symlink junction 逃逸 |

**TDD**：以 M1 9 fixture 为基线（先让它们全部通过），再加新增错误 case。验证：`python -m pytest runtime/tests/protocol/ -v`

### Task 2.2：Project Registry（5 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../persistence/database.py` | `get_db()` — sqlite3 connect + WAL 模式 + `PRAGMA foreign_keys=ON`；`init_db()` — CREATE TABLE IF NOT EXISTS 5 表 |
| `runtime/.../persistence/migrations/001_initial.sql` | DDL：projects/workflow_versions/executor_sessions/audit_events/request_dedup |
| `runtime/.../projects/service.py` | `import_project(path)` — 验证 `.harness` → 插入 SQLite → 返回 ProjectSummary；`list_projects()`/`unregister()`/`validate(path)` |
| `runtime/.../api/` 扩展 | 新增 `/project/list` `/project/import` `/project/validate` 端点 |
| `runtime/tests/projects/test_project_service.py` | 合法导入/非法目录/重复导入/取消注册/只读模式 |
| `apps/renderer/` 扩展 | 项目列表组件（最小实现：展示已注册项目 + 健康状态） |

### Task 2.3：Atomic State Store（4 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../persistence/atomic_files.py` | `atomic_write(path, content)` — tmp→flush→fsync→os.replace；`atomic_read(path)` → bytes |
| `runtime/.../persistence/project_lock.py` | `ProjectLock(project_path)` — 文件锁（Windows: `msvcrt.locking` 或 lockfile）；上下文管理器；超时参数 |
| `runtime/.../persistence/state_store.py` | `write_state(state, expected_revision)` — 获取锁→读 revision→比对→写 tmp→flush→fsync→replace→快照→释放；`read_state(path)` → HarnessState + revision hash |
| `runtime/tests/persistence/test_state_store.py` | 正常读写/revision 冲突/并发冲突/os.replace 失败恢复/os.fsync 失败/锁超时/快照一致性 |

**TDD**：先写故障注入测试（mock replace/fsync 失败），确保旧文件完整、不报成功。

### Task 3.1：Workflow Compiler（3 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../workflow/system_policy.py` | `SYSTEM_MINIMUM_RULES` 常量；`get_effective_rules(project_hard)` → 并集 |
| `runtime/.../workflow/compiler.py` | `compile(workflow, intent, risk)` → `CompiledRoute(required_nodes, diagnostics)`；`simulate(intent, risk)` → 路径 + 理由 |
| `runtime/.../workflow/diagnostics.py` | `WorkflowDiagnostic` 输出（复用 M1 contracts 模型） |
| `runtime/tests/workflow/test_compiler.py` | M1 valid workflow 编译通过/DAG 被拒/删系统节点被拒/simulate 输出正确/自定义节点编译/无效引用报 diagnostics |

### Task 3.2 + 3.3：Run Service + Dispatcher（4 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../runs/identifiers.py` | `validate_run_id(run_id)` — 正则 + 路径安全 + 无盘符 + 唯一性 |
| `runtime/.../runs/service.py` | `create_run(intent, risk)`/`list_runs()`/`switch_run(run_id)`/`pause_run()`/`resume_run()` |
| `runtime/.../workflow/dispatcher.py` | `next_node(state)` → node_id；`confirm(node, decision, comment)`；`change_request(state, new_route)` |
| `runtime/tests/runs/test_run_service.py` | 创建/list/switch/恶意run_id/空格路径/盘符/重复 |
| `runtime/tests/workflow/test_dispatcher.py` | 选择下一个节点/confirmation 阻止未确认/CHANGE_REQUEST diff |

### Task 3.4：Gate Engine（3 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../gates/permissions.py` | `check_gate_permission(gate, caller_role)` → G3-G8 非 verifier → GATE_PERMISSION_DENIED |
| `runtime/.../gates/engine.py` | `evaluate_gate(gate, state, caller)` → PASS/FAIL/WAIVED/BLOCKED；确定性检查；retry 逻辑 |
| `runtime/.../gates/evidence.py` | `validate_evidence(path)` → G6 九字段校验 |
| `runtime/tests/gates/test_gate_engine.py` | 所有 8 gate 正常通过/权限拒绝/G6 缺字段/WAIVED 缺元数据/retry→BLOCKED/failure_recovery 回退/自定义 gate |

### Task 3.5：Artifact Service（2 文件 + 测试）

| 文件 | 内容 |
|---|---|
| `runtime/.../artifacts/service.py` | `read_artifact(project_root, phase_dir, filename)` — 路径校验→读文件→返回 ArtifactInfo(类型/大小/mtime/SHA-256) |
| `runtime/.../artifacts/watcher.py` | `watch_artifacts(phase_dir, callback)` — watchdog/debounce 300ms |
| `runtime/tests/artifacts/test_artifact_service.py` | 合法读取/路径穿越拒绝/symlink 拒绝/大文件分页/Markdown 截断/JSON 超大拒绝/SHA-256 正确 |

## 验证计划

| 阶段 | 命令 | 标准 |
|---|---|---|
| Task 2.1 完成 | `pytest runtime/tests/protocol/ -v` | M1 9 fixtures + 新 case 通过 |
| Task 2.2 完成 | `pytest runtime/tests/projects/ -v` | 导入/拒绝/重复/取消注册 |
| Task 2.3 完成 | `pytest runtime/tests/persistence/test_state_store.py -v` | 含故障注入全通过 |
| Task 3.1 完成 | `pytest runtime/tests/workflow/test_compiler.py -v` | 编译/拒绝/simulate |
| Task 3.2-3.3 | `pytest runtime/tests/runs/ runtime/tests/workflow/test_dispatcher.py -v` | Run 生命周期 + 调度 |
| Task 3.4 完成 | `pytest runtime/tests/gates/test_gate_engine.py -v` | 8 gates + 权限 + retry |
| Task 3.5 完成 | `pytest runtime/tests/artifacts/ -v` | 路径安全 + 哈希 |
| **全量** | `python -m pytest runtime/tests -q` | 全部通过 + M1 无回归 |

## 回滚

- 任何 Task 失败 → 回退该 Task 文件，不波及已完成 Task
- Protocol Adapter 过严 → 降级宽松模式
- 原子写故障 → 非原子写降级
