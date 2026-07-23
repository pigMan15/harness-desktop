# 预发布打包结果

- 命令：`python -m PyInstaller harness-runtime.spec --clean --noconfirm`
- 工作目录：`G:\Project\ai\harness-desktop\runtime`
- 退出码：0
- 结果：PASS
- 关键输出：重新生成 `runtime/dist/harness-runtime.exe`，大小 41089408 bytes。

- 命令：`pnpm --filter @harness/desktop package`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：1
- 结果：FAIL
- 关键输出：Electron Forge 在 packaging 阶段两次因 `read ECONNRESET` 失败。

- 命令：`pnpm exec electron-packager apps\desktop "Harness Desktop" ... --out=dist\desktop-unpacked`
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：使用本地 `node_modules/electron/dist` 重新生成 unpacked 桌面应用。

- 命令：`node -e "createWindowsInstaller(...)"`.
- 工作目录：`G:\Project\ai\harness-desktop`
- 退出码：0
- 结果：PASS
- 关键输出：生成 Squirrel.Windows 安装器。

## 产物

- `dist/desktop-installer/Harness Desktop-0.0.0 Setup.exe`
- `dist/desktop-installer/harness-desktop-0.0.0-full.nupkg`
- `dist/desktop-installer/RELEASES`
- `dist/desktop-unpacked/Harness Desktop-win32-x64/Harness Desktop.exe`
