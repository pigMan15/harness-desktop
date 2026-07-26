# 预发布部署记录

## 环境

- 工作目录：`G:\Project\ai\harness-desktop`
- 分支：`main`
- 版本：`0.2.1`
- Tag：`desktop-v0.2.1`
- 平台：Windows x64

## 命令

1. `pnpm.cmd --filter @harness/desktop package`
   - 结果：FAIL
   - 原因：沙箱内启动 Vite/esbuild 子进程被 Windows 拒绝，报 `spawn EPERM`。

2. `pnpm.cmd --filter @harness/desktop package`
   - 结果：FAIL
   - 权限：已提权
   - 原因：Electron Packager 访问 GitHub 下载 Electron 资源超时，报 `connect ETIMEDOUT 20.205.243.166:443`。

3. `$env:HARNESS_ELECTRON_ZIP_DIR='G:\Project\ai\harness-desktop\dist-functional-alignment-20260723\electron-zips'; pnpm.cmd --filter @harness/desktop package`
   - 结果：PASS
   - 权限：已提权
   - 说明：复用本地 `electron-v31.7.7-win32-x64.zip`，完成 Electron Forge make。

## 产物

- `apps/desktop/out/make/squirrel.windows/x64/Harness Desktop-0.2.1 Setup.exe`
- `apps/desktop/out/make/squirrel.windows/x64/harness-desktop-0.2.1-full.nupkg`
- `apps/desktop/out/make/squirrel.windows/x64/RELEASES`

## 门禁结论

- `G7_PRERELEASE = PASS`
