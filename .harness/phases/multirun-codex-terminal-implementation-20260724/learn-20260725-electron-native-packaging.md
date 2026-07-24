# 学习记录

- 等级：instinct-candidate
- 触发条件：Electron + Vite + pnpm workspace 打包 external native module，并启用 ASAR。
- 失败现象：Vite bundle 成功但 Main 无法解析 native package；或 JS 入口进入 ASAR而 `.node`/DLL 未进入 `app.asar.unpacked`；只检查 package 根文件会误判成功。
- 根因：hoisted dependency 不在 app staging 模块边界；Packager 7 的有效配置为 `asar.unpackDir`，旧式 `asarUnpack` 字段被忽略；普通 package 根 require 与 ASAR Main require 的搜索边界不同。
- 新规则：发布门禁必须同时验证 staging copy、`app.asar.unpacked`、从 ASAR Main 虚拟路径解析模块、正常 GUI 启动 Runtime，以及 native 功能 smoke；任一缺失都不能发布。
- 应写入位置：Desktop 发布规则、`docs/troubleshooting.md`、打包脚本自动检查。
- 人工确认：待用户 review；未自动提升为 instinct。
