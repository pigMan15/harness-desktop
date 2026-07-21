# 预发布部署 — Harness Desktop Foundation (M1)

节点：PRERELEASE_DEPLOYMENT　角色：deployer　产物：`16-prerelease-deployment.md`　门禁：G7_PRERELEASE

## 评估

M1 交付范围不包含部署或安装包：
- PyInstaller 打包 Runtime 属 Phase 6（Task 6.4）
- Electron 安装包（Squirrel.Windows）属 Phase 6
- 代码签名属 Phase 6
- OQ-5 决策已明确：M1 不涉及签名/安装包

## G7_PRERELEASE 门禁预评

M1 无部署行为，G7 的 required_artifacts（16-prerelease-deployment.md + 17-interface-test.md）将与本文件 + 17-interface-test.md 一同以 NOT_REQUIRED 评估。
