# 知识沉淀

- 如果 Electron Forge packaging 阶段因 `ECONNRESET` 下载失败，可以设置 `ELECTRON_OVERRIDE_DIST_PATH` 指向 `node_modules/electron/dist`，使用本地 Electron 运行时完成 `electron-packager`。
- 不要把 package 输出放在 `apps/desktop` 源码目录内部，否则可能把旧 `out/` 目录打进 `app.asar`，导致产物异常膨胀。
- 重新打包 runtime 后，应核对 unpacked 应用中的 `resources/harness-runtime.exe` 大小和时间戳，避免沿用旧 runtime。
