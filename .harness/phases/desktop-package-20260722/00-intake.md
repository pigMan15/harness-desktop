# INTAKE — desktop-package-20260722

## 意图

DEPLOYMENT — 打包 `@harness/desktop` Electron 桌面应用。

## 范围

- 运行 `pnpm --filter @harness/desktop package`（即 `electron-forge make`）
- 生成可分发的 Electron 应用安装包（Squirrel.Windows 格式）
- 验证打包产物完整性

## 风险等级

MEDIUM — 构建/打包操作，不涉及源码变更，但产物将用于分发。

## 验收标准

1. `electron-forge make` 成功完成
2. 产出可分发的安装包文件
3. 接口测试验证产物可启动
