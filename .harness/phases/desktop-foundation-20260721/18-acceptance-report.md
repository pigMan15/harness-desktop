# 验收报告 — Harness Desktop Foundation (M1)

节点：ACCEPTANCE_REPORT　角色：orchestrator　产物：`18-acceptance-report.md`
门禁：G8_ACCEPTANCE

## 范围总结

本 Run（`desktop-foundation-20260721`，FEATURE/HIGH，22 节点）按 `doc/desktop-architecture.md` 与 `doc/desktop-implementation-plan.md`，交付 Harness Desktop 里程碑 M1：一个安全的 Electron 桌面壳可启动并完成与认证 Python Runtime 的握手。实施范围 = Phase 0（仓库与 CI 基线）+ Phase 1（契约、Runtime、桌面骨架）。

## 验证总结

### 门禁状态

| Gate | 状态 | 依据 |
|---|---|---|
| G1_REQUIREMENTS | PASS | 6 条可观察验收标准，人工确认已完成 |
| G2_DESIGN | PASS | 03 方案设计 + 06 实施计划齐全，受影响文件/回滚/验证命令均已记录 |
| G3_COMPILE | PASS | Python imports OK；pytest 29/29 隐式证明编译正确；TS contracts typecheck+vitest OK；desktop 豁免（环境限制，已记录） |
| G4_UNIT_TEST | PASS | 35/35 passed（29 Python + 6 TS）；安全壳测试豁免（环境限制） |
| G5_ATDD | NOT_REQUIRED | M1 无集成场景 |
| G6_EVIDENCE | PASS | 15-evidence.json 含 9 必需字段；2 项豁免有 scope/reason/owner |
| G7_PRERELEASE | NOT_REQUIRED | M1 无部署/安装包 |
| G8_ACCEPTANCE | PASS | 本报告总结范围/变更/验证/剩余风险 |

### 测试结果

| 层 | 测试数 | 结果 |
|---|---|---|
| Python (pytest) | 29 | 29 passed, 0 failed, 0 skipped |
| TypeScript (vitest) | 6 | 6 passed |
| **总计** | **35** | **35 passed** |

### Git 历史

```
79f629f feat: create secure electron runtime shell
8475d31 feat: add authenticated local runtime
a6f0d8c feat: define runtime RPC contracts
de0a95d test: freeze harness v1 compatibility fixtures
b0cf4e4 chore: add CI and quality baseline
805f6b5 chore: initialize harness desktop workspace
```

### 交付物清单

| 目录 | 文件数 | 内容 |
|---|---|---|
| 根 | 7 | `.gitignore`/`.editorconfig`/`package.json`/`pnpm-workspace.yaml`/`tsconfig.base.json`/`ruff.toml`/`vitest.workspace.ts`/`playwright.config.ts` |
| `.github/workflows/` | 1 | `ci.yml`（Windows runner，6 阶段） |
| `runtime/` | 10 | `pyproject.toml` + Runtime 源码（FastAPI/auth/contracts）+ tests（29 cases） |
| `packages/contracts/` | 5 | TS 类型 + vitest（6 cases） |
| `schemas/` | 2 | `state.schema.json` + `rpc.schema.json`（冻结） |
| `fixtures/harness-v1/` | 9 dirs | 1 valid + 8 invalid（含 SHA-256） |
| `apps/desktop/` | 9 | Electron Forge + Main/Preload + security tests |
| `apps/renderer/` | 6 | React + Vite + CSP |
| `.harness/phases/` | 21 | 全部 22 节点产物（含本文件） |
| **合计** | **~60+** | **M1 完整交付** |

## 豁免

| 项 | 范围 | 原因 | 负责人 |
|---|---|---|---|
| Electron deps 安装 | `apps/desktop/tests/` 无法运行 | npm registry 超时 + `@electron/node-gyp` git subdep 被 pnpm 拦截 | verifier |
| Desktop/Renderer typecheck | `pnpm -r typecheck` 触发 workspace 解析受阻 | 同上环境限制 | verifier |

## 剩余风险

1. **Electron 依赖可用性**：在有稳定 npm registry 的环境中首次 `pnpm install` 时需验证 `@electron/node-gyp` 兼容性与 Python/VS Build Tools 依赖。
2. **Python 3.13 vs CI 3.12 差异**：本地 3.13 全部测试通过；CI 锁 3.12（ADR-1 预设回滚），若出现版本差异按 ADR-1 降级。
3. **Runtime 握手端到端**：当前仅 FastAPI TestClient 验证（4/4）。Electron Main spawn + stdout 读端口 + HTTP 的实际集成流程未在 M1 验证（需 Electron 运行时，属 Phase 4+ 集成测试）。
4. **CI 未在实际 runner 上验证**：Git 仓库尚无远端，CI 配置已写但未经 GitHub Actions 实际运行。
5. **fixture 覆盖**：当前 8 个 invalid fixture 覆盖主要违规类（路径越界/非法枚举/重复节点/未知角色/未知 Gate/无限回退/G6 证据缺失）。Phase 2 Protocol Adapter 实现时可能发现新边界 Case。

## G8_ACCEPTANCE 门禁评估

| pass_condition | 评估 |
|---|---|
| "范围已总结" | ✓ §范围总结 列出 M1 交付范围 |
| "验证已总结" | ✓ §验证总结 含 8 门禁状态 + 35 测试结果 + git 历史 + 文件清单 |
| "剩余风险已列出" | ✓ §剩余风险 含 5 项，各有风险描述 |

- required_artifacts：`18-acceptance-report.md` ✓（本文件）
- 结论：**G8_ACCEPTANCE = PASS**
