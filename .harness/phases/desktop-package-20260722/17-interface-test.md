# 接口检查结果

- 检查：安装器文件存在且大小大于 0。
- 结果：PASS。
- 证据：`dist/desktop-installer/Harness Desktop-0.0.0 Setup.exe`，大小 189462016 bytes。

- 检查：unpacked 桌面应用主 exe 存在且大小大于 0。
- 结果：PASS。
- 证据：`dist/desktop-unpacked/Harness Desktop-win32-x64/Harness Desktop.exe`，大小 180850176 bytes。

- 检查：unpacked 应用资源包含本次重新打包的 runtime exe。
- 结果：PASS。
- 证据：`dist/desktop-unpacked/Harness Desktop-win32-x64/resources/harness-runtime.exe`，大小 41089408 bytes，与 `runtime/dist/harness-runtime.exe` 一致。

## 未执行项

- 未执行安装/卸载真实流程。
- 未执行代码签名。
