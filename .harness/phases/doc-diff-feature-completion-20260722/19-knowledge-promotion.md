# 知识沉淀

- 差异清单中的 D13-D16 已形成可运行实现与测试基线。
- Python runtime 能使用标准库 `unittest` 和 `py_compile` 独立验证，运行时需设置 `PYTHONPATH=runtime\src`。
- 前端/桌面/contracts 测试使用各 package 自己的 vitest 配置，根 `pnpm test` 聚合可运行 workspace，避免 root workspace 配置误扫无测试项目。
- Playwright E2E baseline 依赖根项目 `@playwright/test`；在全新环境中完整执行前需要确保 Chromium 浏览器包可安装或预置。
