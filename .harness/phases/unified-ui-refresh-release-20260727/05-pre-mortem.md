# 发布前风险预案

## 风险

- 当前工作区包含多轮功能改动和大量 `.harness` 产物，提交时容易把临时打包目录、测试输出或权限受限目录误加入。
- 本机缺少 GitHub CLI，Release 上传可能不能直接复用仓库内 `gh release` 逻辑。
- `bridle` 在当前机器上因 PyInstaller 解压 `VCRUNTIME140.dll` 权限失败，无法自动创建和校验部署 Run。
- Electron 打包依赖本地原生模块和 Electron 缓存，可能因为安装不完整或文件占用失败。

## 缓解

- 提交前使用 `git status --short` 和显式 pathspec 筛选，仅加入源码、测试、配置、必要 harness 产物，不加入 `out-fresh`、历史 dist、`test-results` 等生成目录。
- 优先使用 Git SSH 凭据推送 commit 和 tag；Release 上传若缺少 `gh`，改查 GitHub Actions 或 API 凭据可用性。
- 将 `bridle` 权限异常写入部署证据；流程状态用 `.harness/state.json` 和 runs 快照手工保持一致。
- 打包前检查版本、Forge 配置和 runtime 资源存在性，打包后记录安装包路径、大小和哈希。
