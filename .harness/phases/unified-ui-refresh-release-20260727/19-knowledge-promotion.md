# 发布知识沉淀

## 候选知识

- Windows Electron Forge 打包时，如果 Packager 下载 Electron zip 因 GitHub 网络超时失败，可通过 `HARNESS_ELECTRON_ZIP_DIR` 指向已审计的本地 Electron zip 目录完成离线打包。
- Git SSH 凭据可以推送代码和 tag，但 GitHub Release 资产上传需要 HTTPS/API 凭据；可通过 Git Credential Manager 获取 `github.com` token 后调用 GitHub API。
- 发布前必须确认 `apps/desktop/out/` 被 `.gitignore` 排除，安装包只上传 Release，不进入源码提交。

## 不沉淀内容

- 本次本地缓存 zip 的具体目录属于机器状态，不作为跨项目固定路径。
- 本次网络超时 IP 属于瞬时环境信息，不作为长期故障结论。
