# 验收报告

## 运行信息

- Run：`project-import-fix-release-20260723`
- 意图：`DEPLOYMENT`
- 风险：`MEDIUM`
- 发布版本：`0.1.0`
- 发布标签：`desktop-v0.1.0`
- 发布地址：https://github.com/pigMan15/harness-desktop/releases/tag/desktop-v0.1.0

## 验收范围

- 统一 Desktop、Renderer、Contracts、Runtime、Forge 元数据和文档中的版本号为 `0.1.0`。
- 从 Runtime 源码重新构建 `harness-runtime.exe`，并将其用于桌面应用打包。
- 通过 GitHub Actions 使用仓库 `GITHUB_TOKEN` 创建公开 Release，避免依赖本机 GitHub 浏览器登录。
- 核对公开 Release、tag、资产状态、文件大小和 SHA-256。
- 验证打包应用启动 Runtime、导入项目、拒绝无效路径并选中导入项目。

## 可观察验收标准

- [x] `desktop-v0.1.0` 解引用指向提交 `d0f8032`，`main` 远端指向发布工作流提交 `5b20ad8`。
  - 验证方式：`git ls-remote origin refs/heads/main` 和 `git ls-remote origin refs/tags/desktop-v0.1.0^{}`。
- [x] GitHub Release 为公开、非草稿、非预发布状态。
  - 验证方式：公开 Release API 返回 `draft=false`、`prerelease=false`。
- [x] Release 包含两个已上传资产。
  - 验证方式：Release API 返回 Setup `128051200` bytes、nupkg `127259858` bytes，两个资产状态均为 `uploaded`。
- [x] 打包应用可以导入当前项目并显示已选中项目。
  - 验证方式：提升权限的 packaged smoke 返回 Runtime `healthy`、项目导入成功、项目数量为 `1`、`selectedLabel=Selected`。
- [x] 无效项目路径被拒绝，且 Runtime 单元测试和桌面相关测试全部通过。
  - 验证方式：无效路径返回明确错误；Runtime `214` 项、Desktop/Renderer/Contracts 共 `31` 项测试退出码为 `0`。

## 门禁结果

| 门禁 | 结果 | 依据 |
| --- | --- | --- |
| G1_REQUIREMENTS | NOT_REQUIRED | DEPLOYMENT/MEDIUM 路径不要求需求评审 |
| G2_DESIGN | NOT_REQUIRED | DEPLOYMENT/MEDIUM 路径不要求方案设计 |
| G3_COMPILE | PASS | `12-compile.md` |
| G4_UNIT_TEST | PASS | `13-unit-test.md` |
| G5_ATDD | NOT_REQUIRED | 当前发布路径不要求 ATDD 节点 |
| G6_EVIDENCE | PASS | `15-evidence.json` 可解析且包含命令、门禁、产物、豁免和剩余风险 |
| G7_PRERELEASE | PASS | `16-prerelease-deployment.md`、`17-interface-test.md` |
| G8_ACCEPTANCE | 待 verifier 标记 | 本报告完成后进行最终门禁检查 |

## 剩余风险

- 安装器未签名，尚未在干净 Windows 虚拟机执行完整安装、升级和卸载循环。
- GitHub Actions 重新构建的公开资产与本地复建包哈希不同，公开 Release API 中的资产哈希是最终发布值。
- 历史 tag `desktop-v0.0.0-20260723` 保留为未发布 tag，未被移动或覆盖。

## 验收结论

发布范围、版本、公开 Release、资产上传和打包项目导入行为均已完成验证。除已明确记录的签名与干净虚拟机覆盖范围外，本次 `0.1.0` 发布满足验收标准，提交 verifier 进行 G8 最终判定。
