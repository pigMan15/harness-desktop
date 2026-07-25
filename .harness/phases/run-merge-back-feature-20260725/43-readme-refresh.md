# README 介绍文档更新

## 变更范围

- 重写中文 `README.md`，更新项目定位、核心能力、架构、安装、开发、验证、打包、安全说明与当前限制。
- 同步重写英文 `README_en.md`，保持中英文内容一致。
- 文档版本更新为 `0.2.0`，并补充 GitHub Releases 入口。
- 开发说明明确 Electron 会自动启动并认证 Python Runtime。

## 验证记录

- 已核对 README 中引用的本地 Markdown 链接，目标文件均存在。
- 已核对 README 标注版本与 `apps/desktop/package.json` 的 `0.2.0` 一致。
- 已执行 `git diff --check -- README.md README_en.md .harness/phases/run-merge-back-feature-20260725/43-readme-refresh.md`。
- 本次仅修改文档，未运行构建与测试。

## 提交范围

- `README.md`
- `README_en.md`
- `.harness/phases/run-merge-back-feature-20260725/43-readme-refresh.md`

其他工作区改动均不属于本次提交。
