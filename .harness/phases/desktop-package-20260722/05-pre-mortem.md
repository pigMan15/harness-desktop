# 失败预演 — desktop-package-20260722

## 背景

打包 `@harness/desktop` Electron 应用（`electron-forge make`，Squirrel.Windows maker）。
无源码变更，仅构建/打包操作。风险 MEDIUM。

## 失败模式

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| electron-forge make 退出非零 | 缺少依赖、TypeScript 编译错误、Vite 构建失败 | 先跑 `pnpm install` 确保依赖完整 | 命令退出码 | 修复错误后重试 |
| Squirrel 打包失败 | Windows SDK 缺失、签名证书问题 | 检查 `electron-winstaller` 依赖已声明 | 命令输出 | 换 maker 或修复环境 |
| 产物缺失/损坏 | 磁盘空间不足、中途崩溃 | 检查 `out/make/` 目录 | 验证产物文件存在且大小 > 0 | 清理后重试 |
| 安装包无法启动 | 运行时依赖缺失、asar 打包遗漏 | 接口测试验证 | 接口测试（INTERFACE_TEST 节点） | 检查 forge 配置 |

## 测试策略

- **构建验证**：`electron-forge make` 退出码 0
- **产物验证**：确认 `out/make/` 下有输出文件
- **接口测试**：验证打包产物可识别（文件类型/大小合理）

## 门禁预期

| 门禁 | 预期 | 原因 |
| --- | --- | --- |
| G1_REQUIREMENTS | NOT_REQUIRED | 无需求变更 |
| G2_DESIGN | NOT_REQUIRED | 无设计变更 |
| G3_COMPILE | NOT_REQUIRED | 无源码变更 |
| G4_UNIT_TEST | NOT_REQUIRED | 无源码变更 |
| G5_ATDD | NOT_REQUIRED | 无行为变更 |
| G6_EVIDENCE | PASS | 记录命令和产物 |
| G7_PRERELEASE | PASS | 执行打包并验证产物 |
| G8_ACCEPTANCE | PASS | 总结打包结果 |

## 回滚预期

打包失败无需回滚——无代码合入，仅清理失败的构建产物即可。

## 停止条件

- `pnpm install` 失败（依赖不完整）
- `electron-forge make` 连续失败 2 次
- 产物文件不存在或大小为 0
