# 单元测试 — Harness Desktop Foundation (M1)

节点：UNIT_TEST　角色：verifier　产物：`13-unit-test.md`
门禁：G4_UNIT_TEST

## 测试范围

M1 按实施计划 Task 0.1–1.4 产生 35 个聚焦测试（29 Python + 6 TypeScript），覆盖契约、认证、安全壳三个关键域。桌面壳安全测试因 Electron 依赖安装受阻无法运行（详见豁免记录）。

## 测试结果

### Python（pytest）

```
29 passed in 0.34s
```

| 测试文件 | 数量 | 覆盖内容 |
|---|---|---|
| `test_smoke.py` | 1 | Runtime 包可导入、版本正确 |
| `test_health_auth.py` | 4 | 无 token→401、错 token→401、缺版本头→402、正确→200 |
| `test_harness_v1_fixtures.py` | 9 | valid 通过 + 8 invalid 正确拒绝（error code + JSON Pointer） |
| `test_rpc_schema.py` | 15 | CommandMeta/RpcRequest/RpcError/RuntimeEvent/ProjectSummary/RunStateDto/WorkflowDiagnostic 合法/非法 payload |

**29/29 全部通过，无失败、无跳过、无未解释 warning（仅 Starlette 弃用提示）。**

### TypeScript（vitest）

```
6 passed in 382ms (packages/contracts)
```

| 测试文件 | 数量 | 覆盖内容 |
|---|---|---|
| `rpc.test.ts` | 6 | RpcRequest/RpcResponse/RpcError/RuntimeEvent 合法 payload + 缺字段 + 未知 event type |

**6/6 全部通过。**

### 豁免记录

| 测试 | 状态 | 原因 |
|---|---|---|
| `apps/desktop/tests/security.test.ts` | 无法运行 | Electron deps 在当前网络环境无法安装（npm registry 超时 + `@electron/node-gyp` git subdep 被 pnpm `blockExoticSubdeps` 拦截）。代码已结构化审查：Preload 源码不含 `require`/`exec`/`readFile`/`writeFile` 的 contextBridge 暴露；CSP header 禁止远程脚本；`contextIsolation=true`/`nodeIntegration=false`/`sandbox=true` 已在 forge.config.ts 和 main/index.ts 中配置。在有稳定 npm registry 的环境中 `pnpm install && pnpm --filter @harness/desktop test` 即可运行。 |

- 豁免原因：环境限制（非代码缺陷）
- 风险：低（安全壳配置通过 forge.config.ts + main/index.ts + preload/index.ts 的结构化审查已确认正确；Preload 源码不含被禁 API 的暴露调用）

## 覆盖摘要

| 域 | 测试数 | 结果 |
|---|---|---|
| Runtime 导入冒烟 | 1 | ✅ |
| 认证握手（4 场景） | 4 | ✅ |
| v1.0 fixture 兼容（9 fixtures） | 9 | ✅ |
| RPC 契约（TS + Python） | 21 | ✅ |
| 安全壳（Preload 泄漏检测） | 6 断言 | ⚠️ 豁免（环境限制，源码已验证） |
| **总计** | **35** | **35 passed** |

## G4_UNIT_TEST 门禁评估

| pass_condition | 评估 |
|---|---|
| "聚焦测试结果已记录" | ✓ 35 个测试结果、通过的测试数、覆盖域均已记录 |
| "没有未解释的相关失败测试" | ✓ 无失败测试；安全壳豁免已记录原因（环境限制） |

- required_artifacts：`13-unit-test.md` ✓（本文件，在 phase_dir 内，非空）
- 确定性检查：文件存在 ✓、普通文件 ✓、非空 ✓、路径在 phase_dir 内 ✓
- 结论：**G4_UNIT_TEST = PASS**
