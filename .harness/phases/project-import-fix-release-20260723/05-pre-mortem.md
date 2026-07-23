# 失败预演

## 失败模式

| 失败模式 | 原因 | 预防 | 发现 | 回滚 |
| --- | --- | --- | --- | --- |
| 提交混入构建缓存、失败包、SQLite、日志或密钥 | 工作树包含多轮构建和 Harness 运行产物 | 逐路径暂存，禁止 `git add -A`；提交前审查暂存文件列表与 diff | `git diff --cached --name-status`、`git diff --cached --check` 和敏感/生成物路径检查 | 在提交前取消错误暂存；提交后但推送前重建干净提交 |
| 远端 `main` 已前进，推送覆盖或丢失他人提交 | 本地基线过期或并行修改 | 发布前 fetch，要求本地相对 `origin/main` 可 fast-forward 推送 | 比较 merge-base、ahead/behind 和远端 HEAD | 停止发布，先整合远端变更并重新执行相关验证；禁止 force push |
| Release tag 已存在但指向不同 commit | 重复发布或命名冲突 | 同时检查本地与远端 tag，创建前确认目标 commit | 查询 `refs/tags/desktop-v0.0.0-20260723` 及 GitHub Release | 停止并使用新的、经确认的 tag；不移动已发布 tag |
| Git push 成功但 GitHub Release 创建失败 | 缺少 GitHub API 凭据、权限不足或网络不可用 | 在创建 tag/Release 前探测 SSH 与 GitHub CLI/API 认证能力 | push/API 返回码，随后查询 Release URL | 保留已推送 commit；必要时删除尚未发布且未被消费的 tag，认证恢复后重试 Release，不宣称发布完成 |
| 上传了旧的 v1/v2 包或资产内容变化 | 多个同名打包目录并存，上传路径选择错误 | 只允许 `dist-project-import-fix-20260723-v3`；上传前后核对大小与 SHA-256 | 本地哈希、GitHub asset 元数据和下载后哈希比对 | 删除错误 Release asset，重新上传 v3；若 Release 已被使用则发布修正版 tag |
| 源码 commit 与包内 runtime/桌面功能不一致 | 最终包并非由已验收工作树构建，或 runtime.exe 被旧产物替换 | 固定已验收 v3 包及其 runtime 哈希，提交包含对应 `apps/desktop/resources/harness-runtime.exe` | 对照 commit 文件、Setup/nupkg/hash 和既有验收证据；发布后安装/接口冒烟 | 撤回或标记 Release 为 pre-release，保留证据并重新构建、复验、发布新 tag |
| 大文件上传中断或 GitHub 资产截断 | 网络波动或 API 上传失败 | 单资产串行上传并保留本地原件 | API 状态、资产 size 和重新下载哈希 | 删除不完整资产后重传；未完成前不推进验收 |

## 测试策略

- 发布前复核上一 Run 已通过的 Desktop、Renderer、contracts、Runtime、TypeScript、生产构建和 packaged import smoke 证据，并确认最终 v3 资产哈希未变化。
- 使用 Git 检查验证暂存边界、补丁格式、远端 ahead/behind、push 结果和 tag 指向。
- 使用 GitHub Release API 或 `gh` 验证 Release 可见、标题/tag/commit 正确、两个资产均存在且大小正确。
- 对上传资产重新下载或读取远端内容计算 SHA-256；至少执行发布资产与本地 v3 的二进制一致性检查。
- `INTERFACE_TEST` 记录 Git SSH、GitHub Release API、Release 下载接口以及最终安装包/项目导入冒烟结果。

## 门禁预期

- `G2_DESIGN`：本 Deployment/Medium 路径不要求 `SOLUTION_DESIGN` 和 `IMPLEMENTATION_PLAN`，保持 `NOT_RUN`，不在本节点越权标记。
- `G7_PRERELEASE`：需有 `16-prerelease-deployment.md` 与 `17-interface-test.md`，记录环境、commit、tag、Release URL、资产元数据与冒烟结果后由 verifier 判定。
- `G6_EVIDENCE`：需由 verifier 在 `15-evidence.json` 汇总命令、文件、门禁、资产哈希、豁免和剩余风险。
- `G8_ACCEPTANCE`：需在发布事实可复查、G6/G7 证据完整后由 verifier 标记。
- `G1_REQUIREMENTS`、`G3_COMPILE`、`G4_UNIT_TEST`、`G5_ATDD`：当前 Deployment/Medium 路径不要求；既有功能修复 Run 的验证只能作为发布输入，不替代本 Run 的必需节点。

## 回滚预期

- 提交前：移除错误暂存，不修改或删除用户未提交的工作树内容。
- 推送前：发现远端分叉、tag 冲突、哈希变化或认证不可用即停止。
- 仅 commit 已推送：保留 commit 历史，修复后追加提交；不改写 `main`。
- tag 已推送但 Release 未完成：若 tag 尚未被公开消费，可删除远端 tag 后重试；否则使用新 tag，禁止移动已发布 tag。
- Release 已公开且资产错误：先撤回或标记 pre-release，删除错误资产并在可证明一致时重传；若已有下载者，发布修正版 tag 并清楚说明替代关系。

## 停止条件

- 暂存区包含 `runtime/build`、`apps/desktop/out-fresh`、`test-results`、`.claude`、任一 `dist-*`、数据库、日志、pytest 临时目录、失败包或疑似凭据。
- `origin/main` 包含本地未整合提交，或推送需要 force。
- 本地/远端 tag 冲突，或 tag 不能唯一指向待发布 commit。
- v3 Setup、nupkg 或包内 runtime 的 SHA-256 与已验收值不一致。
- GitHub 认证或 Release/asset 上传权限不可用。
- 任一上传资产缺失、大小不符、下载哈希不符，或项目导入冒烟失败。
