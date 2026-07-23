# 实施计划

## 目标

将可行打包路径补充到 README 文档。

## 任务列表

1. 在 `README.md` 技术栈之后新增 `## 打包`。
2. 在 `README_en.md` 当前能力之后新增 `## Packaging`。
3. 写明首选脚本和 fallback 命令。
4. 写明产物路径和注意事项。

## 验证计划

- `rg -n "## 打包|## Packaging|ELECTRON_OVERRIDE_DIST_PATH|desktop-installer" README.md README_en.md`

## 回滚计划

- 回滚 `README.md` 和 `README_en.md` 的新增章节。
