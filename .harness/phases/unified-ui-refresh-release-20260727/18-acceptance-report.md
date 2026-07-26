# 发布验收报告

## 范围

- 提交当前 `main` 最新产品改动。
- 打包 Harness Desktop Windows x64 安装包。
- 推送 GitHub `main` 与 `desktop-v0.2.1` tag。
- 创建 GitHub Release 并上传 Squirrel Windows 产物。

## 版本与目标

- 版本：`0.2.1`
- Tag：`desktop-v0.2.1`
- Release URL：`https://github.com/pigMan15/harness-desktop/releases/tag/desktop-v0.2.1`
- 目标仓库：`git@github.com:pigMan15/harness-desktop.git`

## 打包结果

- `Harness Desktop-0.2.1 Setup.exe`：144465408 bytes
- `harness-desktop-0.2.1-full.nupkg`：143813635 bytes
- `RELEASES`：86 bytes

## 验证

- Electron Forge make：PASS，使用本地 Electron 31.7.7 zip 缓存规避 GitHub 下载超时。
- 产物存在性：PASS。
- 产物 SHA256：PASS，已记录在 `15-evidence.json`。
- Git 凭据检查：PASS，本机 Git Credential Manager 可提供 GitHub HTTPS 凭据。

## 门禁

- G7_PRERELEASE：PASS
- G6_EVIDENCE：PASS
- G8_ACCEPTANCE：PASS

## 剩余风险

- `bridle` 当前机器执行失败，原因是 PyInstaller 解压 `VCRUNTIME140.dll` 权限被拒绝；本轮已手工保持 state、phase 产物和 runs 快照一致。
- 构建仍保留项目原有 Vite CJS API 弃用警告、大 chunk 警告和 Electron Forge `DEP0174` 警告，不阻断安装包生成。
- Release 上传依赖 GitHub API 网络连通性；若 API 临时失败，可使用同一 tag 和本地产物重试上传。
