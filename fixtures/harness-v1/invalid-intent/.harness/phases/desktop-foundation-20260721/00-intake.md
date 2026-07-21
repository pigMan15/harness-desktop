# Dispatcher 决策 — INTAKE

- **意图**：FEATURE（构建全新桌面应用）
- **风险**：HIGH
- **当前节点**：INTAKE（已完成，产物即本文件）
- **下一节点**：CONTEXT_PACK
- **下一角色**：requirement-analyst
- **必需产物**：`00-context-pack.md`
- **必需规则/上下文**：requirement-analyst 角色文件、`.harness/rules/artifact-location.md`、`doc/desktop-architecture.md`、`doc/desktop-implementation-plan.md`
- **原因**：用户要求按 `doc/` 中的架构方案与实施计划开发 Harness Desktop。首发为 Windows 桌面应用，安全敏感面广（Electron 沙箱、Keychain、路径穿越防护、Codex 子进程、密钥脱敏），故按 FEATURE/HIGH 路由。本次 Run 聚焦实施计划 Phase 0 + Phase 1，交付里程碑 M1（可启动认证 Runtime 的安全 Electron 壳）。路由已由 `bridle new` 冻结为 22 节点 FEATURE/HIGH 线性路径；活动 Run 路由冻结，后续 `workflow.yaml` 修改只影响新 Run，迁移活动 Run 必须走 CHANGE_REQUEST。

## 任务摘要

### 目标
构建 Harness Desktop 首发基础：一个 Windows 首发、严格兼容 `.harness` v1.0、可驱动 Codex 的桌面应用骨架。本 Run 交付实施计划里程碑 **M1**：安全 Electron 壳可启动认证 Python Runtime。

### 范围（本 Run = Phase 0 + Phase 1）

**Phase 0 — 仓库与开发基线**
- Task 0.1：初始化独立仓库与 pnpm workspace（`.gitignore`、`.editorconfig`、`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`runtime/pyproject.toml`、`README.md`）；`git init` + 开发分支 `codex/desktop-foundation`。
- Task 0.2：CI 与质量基线（`.github/workflows/ci.yml` Windows runner；`ruff.toml`、`vitest.workspace.ts`、`playwright.config.ts`；Runtime 覆盖率 85%，核心 protocol/workflow/state/gate 95%）。

**Phase 1 — 契约、Runtime 与桌面骨架**
- Task 1.1：冻结 `.harness` v1.0 兼容 fixture（`fixtures/harness-v1/valid-project` 与多个 `invalid-*`；`schemas/state.schema.json`、`schemas/rpc.schema.json`；契约测试分类有效/无效）。
- Task 1.2：共享 RPC 契约（`packages/contracts` TS + `runtime/.../contracts/models.py` Pydantic，同源 JSON Schema；`CommandMeta` 含 requestId/projectId/runId/expectedRevision）。
- Task 1.3：Runtime 健康检查与认证握手（loopback `127.0.0.1:0`、一次性 token、`runtime.health` 返回 Desktop/Runtime/Project Protocol 三版本与进程信息；握手失败立即退出）。
- Task 1.4：Electron Main/Preload/Renderer 壳（`contextIsolation=true`、sandbox、`nodeIntegration=false`；`window.require`、通用 exec/readFile/writeFile 不可用；`RuntimeSupervisor` 启动 Python、读握手端口、完成 token 校验、异常退出发事件；Renderer 显示 Runtime healthy/unavailable）。

### 非目标（本 Run 不含，留待后续 Run）
- AtomicStateStore、Dispatcher、GateEngine、ArtifactService、Workflow Compiler（Phase 2–3）。
- Workflow Studio、Node Catalog、自定义编排编译器与版本服务（Phase 3–4）。
- Codex Adapter、Approval Service、Execution 页面（Phase 5）。
- Audit Projection、Recovery Service、Knowledge Promotion、Windows 安装包/签名/自动更新（Phase 6）。
- 端到端 Playwright 验收与发布候选（Phase 7）。

### 关键约束（来自架构方案 §3、§5、§14）
1. **项目协议不重写**：首发不引入 `project.yaml` 或 `events/<run>.jsonl`；`state.json` 是唯一状态事实源，`state.phase_dir` 是阶段产物唯一写入位置，`runs/<id>/state.json` 是快照。Desktop 的 SQLite/事件流/缓存都是可重建派生数据，不参与项目状态裁决。
2. **独立实现，协议兼容**：不 import、复制或相对路径调用 `harness_cli` 源码；Runtime 独立实现 `.harness` v1.0 Protocol Adapter，用冻结 fixture 与 contract test 防止行为漂移。
3. **三层边界**：Renderer 不直接访问 Node.js/Shell/SQLite/项目文件；所有写入经 Runtime command 并携带 `expected_revision`；Preload 只暴露类型化业务 API，不暴露通用 exec/readFile/writeFile。
4. **安全模型**：`contextIsolation=true`、`nodeIntegration=false`、启用 sandbox；CSP 禁止任意/远程脚本；Renderer 不持有 Runtime token；路径 canonicalize 后验证仍在授权根目录，拒绝 symlink/junction 逃逸；run_id/Node/Gate/文件名使用白名单；secret 存 OS Keychain，日志与诊断包脱敏；Runtime token 短时有效、监听 loopback、协议握手失败立即退出。
5. **v1 线性路由**：首发只支持有序线性路由；DAG、并行、循环、运行时动态分支、多 Agent 并发属 `.harness` v2，Desktop 首发不得以内部需求为由静默写 v2 格式。

### 验收标准（M1，对应实施计划 §3 与架构 §20）
- 空工作区命令 `pnpm install`、`python -m pip install -e runtime[dev]`、`pnpm typecheck`、`python -m pytest runtime/tests -q` 退出码均为 0，无配置错误（Task 0.1）。
- CI 能阻断故意失败的 fixture 测试，恢复后通过（Task 0.2）。
- 有效 `.harness` v1.0 fixture 通过，无效 fixture 返回稳定 error code + JSON Pointer（Task 1.1）。
- TS 与 Python 类型都从同一 JSON Schema 验证示例 payload；字段缺失/未知 enum/版本不匹配用例失败（Task 1.2）。
- 无 token、错误 token、协议不兼容均被拒绝；`runtime.health` 返回三版本与进程信息（Task 1.3）。
- `window.require`、通用 exec/readFile/writeFile 均不可用；`RuntimeSupervisor` 启动 Python、读握手端口、完成 token 校验、异常退出发事件；Renderer 显示 healthy/unavailable（Task 1.4）。

### 参考文档
- 架构方案：`doc/desktop-architecture.md`（最终方案，2026-07-21）。
- 实施计划：`doc/desktop-implementation-plan.md`（Phase 0–7、22 内置节点、里程碑 M1–M7）。

### 前置条件与风险（供 CONTEXT_PACK / SOLUTION_DESIGN 处理）
- 本仓库 `G:\Project\ai\harness-desktop` 当前仅含 `.harness`、`doc`、`AGENTS.md`、`CLAUDE.md`、`README*`、`LICENSE`；尚无 `apps/`、`runtime/`、`packages/`、`pnpm-workspace.yaml`。Phase 0 从零创建。
- 当前环境非 git 仓库（`Is a git repository: false`），Task 0.1 需 `git init` 与分支创建。
- 系统仅检测到 Python 3.13.6（`py -3`）；实施计划 Task 0.1 要求 `>=3.11,<3.13`。需在 SOLUTION_DESIGN 决策：要么放宽 Runtime Python 上限至 3.13，要么安装 3.11/3.12 解释器。PyInstaller 打包 Runtime 时解释器版本必须对齐。
- 权威兼容 fixture 应从已发布 Harness 模板复制（架构 §17），CI 对版本与哈希显式审核，不在测试时依赖相邻 `harness-main` 目录。本仓库 `.harness/` 本身即 v1.0 模板来源之一，可作为初始 fixture 基线，但需独立冻结到 `fixtures/harness-v1/`。
- `bridle` v0.1.0 CLI 可用，其 `state.schema.json`/`workflow.yaml`/`gates.yaml` 可作为契约对照源。

## 下一步
进入 **CONTEXT_PACK**（requirement-analyst）：基于本 INTAKE 与 `doc/` 两份文档产出 `00-context-pack.md`，冻结本 Run 的需求边界、利益相关方、验收标准与上下文引用，供后续 REQUIREMENT_REVIEW 与 G1_REQUIREMENTS 门禁使用。
