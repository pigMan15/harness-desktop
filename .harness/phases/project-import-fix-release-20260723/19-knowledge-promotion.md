# 知识沉淀草案

## 来源

- RunId：`project-import-fix-release-20260723`
- Intent：`DEPLOYMENT`
- Risk：`MEDIUM`
- Phase dir：`.harness/phases/project-import-fix-release-20260723`
- 原始 PRD / context-pack：本 run 未配置 `00-context-pack.md`；以 `00-intake.md`、`15-evidence.json` 和 `18-acceptance-report.md` 作为可审计输入。

## 候选知识

| 类型 | 优先级 | 领域 | 置信度 | 标题 | 相对原始输入的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pattern | 高 | GitHub 发布 | 高 | 使用 tag 固定的 Actions 工作流替代本机 Release 登录 | 本机只有 SSH 推送凭据时，仍可由推送到 `main` 的工作流 checkout 固定 tag，并使用仓库 `GITHUB_TOKEN` 创建公开 Release 和上传资产 | `.github/workflows/release.yml`、Actions run `29978736826`、`17-interface-test.md` | 发布规则或 CI/CD 文档 |
| rule | 高 | 发布验收 | 高 | Release 必须同时核对远端元数据和资产状态 | 发布完成不能只看 Actions 成功；必须通过公开 Release API 核对 tag、draft/prerelease、资产数量、`uploaded` 状态、大小和最终哈希 | `17-interface-test.md`、`18-acceptance-report.md` | 发布验收规则 |
| pattern | 高 | Electron 打包 | 高 | 目录生成不等于桌面应用可运行 | Electron 包生成后至少需要检查 `app.asar` 入口、Runtime 版本，并执行真实打包应用启动、Runtime health 和首个业务导入冒烟 | `12-compile.md`、`packaged-import-smoke-0.1.0-elevated.json`、`18-acceptance-report.md` | 桌面构建与证据规则 |
| pitfall | 中 | 构建产物 | 高 | 本地复建包与 Actions 产物哈希可能不同 | Actions 在 `windows-latest` 重新构建时，公开资产哈希不应与本地复建包强行相等；应以远端 API 返回的最终资产为发布事实，并保留本地构建来源和验证记录 | `16-prerelease-deployment.md`、`17-interface-test.md`、`15-evidence.json` | 发布故障排查手册 |
| rule | 中 | Runtime 版本 | 高 | Runtime 版本必须和桌面包版本一起验收 | 版本升级不只改安装器名称；还要检查 Runtime handshake/version 响应、资源目录中的重新构建 Runtime、应用元数据和 Release 标签 | `12-compile.md`、`13-unit-test.md`、`packaged-import-smoke-0.1.0-elevated.json` | 版本发布检查清单 |

## 不建议沉淀的内容

- 本次 Release 的具体文件大小、SHA-256、run ID 和 commit：它们是当前发布的审计事实，不是长期工程规则。
- `desktop-v0.0.0-20260723` 和 `desktop-v0.1.0` 的一次性 tag 关系：保留在发布记录中，不抽象成通用命名规则。
- 当前机器无法运行干净 Windows 虚拟机的环境限制：写入本次验收的剩余风险即可，不升级为产品约束。
- 一次性的缓存、临时目录、测试日志和本地浏览器页面状态：不具备复用价值。

## 待用户确认

- 是否将“公开 Release API 资产核验”加入仓库的长期发布规则。
- 是否将“打包后真实启动 + Runtime health + 首个业务冒烟”加入桌面构建的强制证据门禁。
- 是否将“本地 SSH 推送 + Actions `GITHUB_TOKEN` 发布”作为默认无本机登录发布路径。

本草案只输出建议位置，不自动写入长期知识库，等待人工 review。
