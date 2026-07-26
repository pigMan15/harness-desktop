# 部署 Intake

- RunId：`unified-ui-refresh-release-20260727`
- Intent：DEPLOYMENT
- Risk：MEDIUM
- 目标：提交当前最新代码，打包 Harness Desktop，并通过 Git 凭据推送到 GitHub 与 Release。
- 版本：`0.2.1`
- Tag：`desktop-v0.2.1`
- 范围：沿用 `unified-ui-refresh-20260727` 的统一 UI 与模块间距成果，并包含当前工作区已实现的设置、门禁、Knowledge、Terminal、Run merge、Recovery 等产品改动。

## 验收标准

- Git 工作内容经过精确筛选后提交到 `main`。
- Electron Forge 生成 Windows 安装包产物。
- Git 远端 `origin` 推送成功。
- `desktop-v0.2.1` tag 推送成功。
- Release 产物上传到 GitHub，或记录受限原因和可恢复动作。
