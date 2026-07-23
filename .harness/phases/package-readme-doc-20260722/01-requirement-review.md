# 需求评审

## 目标

把本次实际可行的桌面应用打包方式写入 README，让后续维护者在 PowerShell 5 或 Electron Forge 网络失败时能复现打包。

## 范围

- 更新 `README.md`。
- 更新 `README_en.md`。
- 记录首选脚本路径和可行 fallback 路径。

## 非目标

- 不重新执行打包。
- 不清理或回退已有打包产物。
- 不修改打包脚本。

## 验收标准

- README 中文文档包含 `## 打包` 章节。
- README 英文文档包含 `## Packaging` 章节。
- 文档列出 runtime 重新打包、Electron 本地 dist 打包、Squirrel 安装器生成和成功产物路径。

## 开放问题

- 无。

## 风险备注

- 文档中的 fallback 是基于当前 Electron 31.7.7 和本次本机验证结果，后续升级 Electron 时需要同步版本号。
