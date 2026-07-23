# 知识沉淀草稿

## 来源

- RunId：`desktop-functional-alignment-20260722`
- Intent：`FEATURE`
- Risk：`MEDIUM`
- Phase dir：`.harness/phases/desktop-functional-alignment-20260722`
- 原始 PRD / context-pack：`doc/desktop-architecture.md`、`doc/desktop-implementation-plan.md`、`00-context-pack.md`
- 变更依据：`08-change-request.md`
- 验证依据：`12-compile.md`、`13-unit-test.md`、`15-evidence.json`、`18-acceptance-report.md`

## 候选知识

| 类型 | 优先级 | 标题 | 相对 PRD 的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- | --- |
| adr | 高 | 多 Run 并行时 Run 快照必须成为权威状态 | 原始输入仍把根 `.harness/state.json` 与 Run snapshot 一并描述为事实源；实现中确认根 state 只能是 selected Run 的兼容投影，`runs/<run_id>/state.json` 才能承载每个 Run 的 revision、gate、retry 和 phase 状态。陈旧根投影不得反向覆盖 Run 权威文件，锁粒度也必须落在 Run。 | `08-change-request.md`；持久化与 Run service 测试；Runtime 全量 214 项通过；`18-acceptance-report.md` 多 Run 增量验收 | 架构决策：Harness 状态权威与并发模型 |
| pattern | 高 | 执行会话在启动时冻结完整归属 | UI 的 selected Run 只能提供新操作默认值，不能成为后台会话事实源。Session 启动后应持久化 project、run、worktree、branch、thread、turn，并在 poll/respond/cancel 时校验调用方归属；恢复也按 session 记录处理，不能根据根 state 推断。 | Execution API、Renderer 与 recovery 测试；SQLite metadata；双 session 与切换 Run 场景通过 | 接口约定：Execution session 生命周期与恢复 |
| pitfall | 中 | Windows 上不要用 `os.kill(pid, 0)` 作为纯存活探测 | 开发验证发现 Windows 的 Python PID 检查语义不适合作为无副作用探测；ProjectLock 与 Recovery 改用 `OpenProcess` 查询，避免存活检查对目标进程产生错误影响。 | `project_lock.py`、`recovery/service.py` 实现；Runtime 全量测试通过；开发记录 | 历史问题：Windows 进程存活检测 |
| rule | 高 | 外部执行器可用性必须以实际可执行为准 | 本机 WindowsApps 中存在 Codex 文件，但桌面外部进程执行被拒绝。仅检查路径存在会产生假阳性；probe 必须实际调用版本与 app-server 能力，任一步失败都返回 unavailable 和诊断，不能回退 Fake 后伪装成功。 | 包内 Runtime 场景 `codexAvailable: false`；Codex adapter/API 测试；验收标准 12、14 | Harness rules：外部执行器能力探测；Codex 接入说明 |
| case | 中 | Electron 无网络打包应固定本地运行时并校验嵌入产物 | Forge 受 child PATH、沙箱下载权限和网络重置影响时，可使用已安装 Electron 版本生成本地 zip，再以 `electron-packager --electron-zip-dir` 和 `electron-winstaller` 完成 Windows 包。中断的 packager 输出可能包含无效主 exe，不能仅凭目录存在判定成功；最终需做 PE/启动 smoke，并核对 nupkg 内 Runtime hash 与 clean Runtime 一致。 | `15-evidence.json`；clean Runtime、unpacked smoke、安装包和 nupkg hash；失败目录保留记录 | 构建手册：Windows 离线桌面打包与完整性校验 |

## 增量判断

- 可复用性：以上结论分别适用于后续多 Run 并发、执行器接入、Windows 恢复与桌面发布任务，不依赖当前 Run 的临时 ID。
- 证据充分性：每条均有实际实现、测试或最终产物验证支撑，不包含未验证猜测。
- 与原始输入差异：候选项均来自开发或打包阶段确认的边界与故障，不重复“显式选择项目”“Workflow 只影响新 Run”“G3-G8 需 verifier”等 PRD 已明确规则。

## 不建议沉淀的内容

- Projects、Runs、Workflow、Gates、Execution 的普通页面功能：原始 PRD/context-pack 已明确，不属于增量知识。
- 本次具体 run ID、临时数据库、stdout/stderr 内容和失败目录名：只对当前运行取证有价值。
- 安装包具体大小与 SHA-256：应保留在本 Run evidence/release 记录中，不应成为长期规则。
- 当前机器的具体 WindowsApps 版本路径：包含环境版本细节；长期知识只保留“路径存在不等于可执行”的规则。
- Playwright 使用系统 Edge 的一次性命令：属于当前环境绕行；可沉淀的是测试必须记录实际浏览器来源，而不是固定某个机器路径。
- 未签名和未执行干净 VM 矩阵：已确认非目标和剩余发布风险，不应包装成已解决知识。

## 待用户确认

- 是否将“多 Run 权威状态与根投影边界”提升为正式 ADR。
- 是否将“外部执行器必须实际执行 probe”写入 Harness 稳定规则。
- 是否将 Windows 离线打包案例并入项目构建/发布手册。
- 本草稿仅写入当前 phase_dir，尚未写入 Obsidian、LLM Wiki 或长期知识库。
