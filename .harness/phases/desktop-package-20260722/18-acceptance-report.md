# 验收报告

## 范围

重新打包 runtime.exe，并生成 Harness Desktop Windows 桌面应用与 Squirrel 安装器。

## 结果

- Runtime 重新构建成功：`runtime/dist/harness-runtime.exe`，41089408 bytes。
- Unpacked 桌面应用生成成功：`dist/desktop-unpacked/Harness Desktop-win32-x64/Harness Desktop.exe`。
- 安装器生成成功：`dist/desktop-installer/Harness Desktop-0.0.0 Setup.exe`，189462016 bytes。

## 说明

`pnpm --filter @harness/desktop package` 两次在 Electron Forge packaging 阶段遇到 `read ECONNRESET`。为完成打包，改用本地 `node_modules/electron/dist` 执行 `electron-packager`，再用 `electron-winstaller` 生成 Squirrel 安装器。

## 剩余风险

- 未执行真实安装、卸载、升级验证。
- 未签名。
- 旧的 `apps/desktop/out-fresh/` 是中间尝试产物，不作为最终交付。
