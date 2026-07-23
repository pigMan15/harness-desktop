# Dispatcher 决策

- 意图：`DEPLOYMENT`（用户指定，不覆盖）
- 风险：`MEDIUM`（用户指定，不覆盖）
- 当前节点：`INTAKE`
- 下一节点：`PRE_MORTEM`
- 下一角色：`quality-guardian`
- 必需产物：`.harness/phases/project-import-fix-release-20260723/00-intake.md`
- 必需规则/上下文：`.harness/commands/release-check.md`、`.harness/rules/deployment.md`、`.harness/rules/safety.md`、`.harness/context/release.md`
- 原因：用户明确授权提交代码、推送远端并创建 GitHub Release 上传打包产物；发布前必须先冻结提交范围、版本/tag、回滚和凭据策略。

## 发布目标

- 仓库：`git@github.com:pigMan15/harness-desktop.git`
- 分支：`main`
- 目标环境：GitHub 远端主分支与正式 GitHub Release（用户已明确授权，不是默认推断）。
- 建议 tag：`desktop-v0.0.0-20260723`
- Release 标题：`Harness Desktop 0.0.0 - Project Import Fix`
- 源码基线：当前 `HEAD=df2c4a6`，`origin/main=df2c4a6`。
- 最终交付目录：`dist-project-import-fix-20260723-v3`
- Release assets：
  - `Harness Desktop-0.0.0 Setup.exe`
  - `harness-desktop-0.0.0-full.nupkg`
  - SHA-256 校验信息写入 Release notes/检查文件。

## 已知状态

- `gh` CLI 未安装，环境变量中没有 `GH_TOKEN`/`GITHUB_TOKEN`。
- Git 远端使用 SSH；push 可尝试现有 SSH 凭据，创建 Release 需额外核对 GitHub API/credential manager 或安装并认证 `gh`。
- 工作树包含多轮已验收源码和 Harness 记录，也包含构建中间文件、测试输出、旧失败包和最终 v3 包；不得使用 `git add -A` 无差别提交。
- 最终 v3 Setup SHA-256：`1EDA9182EAC5ED83ECC8AA8BD47EB38B63B77B751158B49DFAD9FE55FE1F6F4C`。
- 最终 v3 nupkg SHA-256：`7CF43BCB5BFE9D881DD44301909E76298261F7C9B09713E0FBE760231E709508`。

## 范围

- 审核并提交已验收的 Desktop/Renderer/Runtime/contracts 源码、测试、文档与必要 Harness 审计记录。
- 排除 `runtime/build`、`apps/desktop/out-fresh`、`test-results`、`.claude`、所有 dist 包目录和运行时数据库/日志。
- 推送 `main`，创建并推送 release tag。
- 创建 GitHub Release，上传最终 v3 Setup 与 nupkg；失败 v1/v2 不上传。
- 发布后核对远端 commit、tag、Release 和 asset 大小/hash。

## 停止条件

- 暂存区混入未审计的生成物、密钥、临时数据库或失败包。
- 远端 `main` 已出现未合并提交，不能安全 fast-forward 推送。
- 代码门禁/最终包 hash 与已验收证据不一致。
- 无可用 GitHub Release 认证方式；允许先完成 commit/push，但不得谎称 Release 已创建。
