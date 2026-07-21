# 接口测试 — Harness Desktop Foundation (M1)

节点：INTERFACE_TEST　角色：tester　产物：`17-interface-test.md`　门禁：G7_PRERELEASE

## 评估

M1 无部署环境、无对外接口、无集成测试场景：
- Playwright E2E 属 Phase 7
- 没有可测试的用户界面交互（Electron 壳在无 Electron 依赖时无法启动）
- Runtime /health 端点已通过 FastAPI TestClient 验证（4 场景），不构成独立的接口测试需求

## G7_PRERELEASE 门禁（联合 16-prerelease-deployment.md 评估）

- required_artifacts：`16-prerelease-deployment.md` ✓ + `17-interface-test.md` ✓（本文件）
- M1 无部署无接口场景 → **G7_PRERELEASE = NOT_REQUIRED**
