# 编码设计 — Phase 2 State Machine

节点：CODING_DESIGN_CONFIRMATION　角色：developer

## 推荐方案

按 Task 2.1→2.2→2.3→3.1→3.2→3.3→3.4→3.5 依赖链推进。每个 Task 在 `runtime/` 子目录下新增模块 + 对应 `tests/` 子目录。TDD：先写测试（pytest）→ 最小实现 → 全量 `pytest runtime/tests -q` 验证无 M1 回归。

## 架构风格

- **延续 M1 分层**：protocol/（数据模型+校验）→ persistence/（存储+锁）→ workflow/（编译+调度）→ runs/ + gates/ + artifacts/（业务服务）
- **依赖注入**：FastAPI Depends 注入 db session、project path、caller role
- **状态无关函数**：compiler/dispatcher/gate engine 全部为纯函数 `f(input) → output`，不持有状态（状态只在 StateStore 中）

## 实现顺序

```
2.1 Protocol Adapter (模型+加载+校验)
 → 2.2 Project Registry (SQLite+服务)
   → 2.3 Atomic State Store (锁+原子写+快照)
     → 3.1 Workflow Compiler (规则+编译+模拟)
       → 3.2 Run Service (生命周期)
         → 3.3 Dispatcher (节点路由+确认)
           → 3.4 Gate Engine (确定性检查+权限+重试)
             → 3.5 Artifact Service (安全读取+监听)
```

## 模块边界

- `protocol/` — 只读 `.harness/` 文件，不写
- `persistence/` — 唯一写入路径（通过 StateStore），其他模块必须经此写入
- `workflow/compiler.py` — 纯函数，不访问文件系统
- `workflow/dispatcher.py` — 只读 state，通过 StateStore 写
- `gates/engine.py` — 纯函数（输入 state + gate_id + caller_role → 输出 gate_status）
- `artifacts/service.py` — 只读文件（project_root + phase_dir 白名单内）

## 复用 M1 代码

- `runtime/contracts/models.py` — Pydantic 基类扩展
- `runtime/api/app.py` — FastAPI 实例，注册新路由
- `runtime/api/auth.py` — token 校验复用（所有新端点需认证）
- `runtime/tests/contract/test_harness_v1_fixtures.py` — `validate_fixture()` 逻辑提取到 Protocol Adapter

## 不采用

- ORM（SQLite 用 raw SQL + dict 返回）
- 异步（全同步，M1 保持一致）
- 代码生成（Pydantic 手写 + pytest 保证一致性）

## commit 策略

每 Task 一个 commit，共 8 commits。消息格式：`feat: add Protocol Adapter` / `feat: add atomic state store` ...

**确认编码设计？（确认后立即开始 DEVELOPMENT）**
