# 知识沉淀草稿

## 来源

- RunId: `run-merge-safety-20260726`
- Intent: `FEATURE`
- Risk: `MEDIUM`
- Phase dir: `.harness/phases/run-merge-safety-20260726`
- 原始输入: `00-context-pack.md`

## 候选知识

| 类型 | 标题 | 相对原始输入的新增点 | 证据 | 建议位置 |
| --- | --- | --- | --- | --- |
| pattern | Git 写操作采用“只读预检 + 最终重校验”双阶段模式 | 实际实现证明 Renderer 的预检结果不能作为授权事实；执行 API 必须重新检查 revision、HEAD 和 clean status | Runtime 测试覆盖预检 HEAD 不变；执行仍使用 `--ff-only` | Git 集成/安全模式 |
| pattern | 预期 Git 异常应返回结构化 issue，而不是依赖长异常字符串 | `code/title/action/details` 让 UI 能稳定展示问题卡、技术详情和用户接管动作，同时避免长日志破坏布局 | `preflight_run_merge_back` 与 `merge-assistant.ts` | Desktop Runtime API 约定 |
| rule | 软件不得自动处理用户脏工作区 | 即使可以实现 stash/reset，也不能在没有明确授权时改变用户工作树或历史；应阻止并提供刷新、终端和复制命令 | target/run dirty 真实 Git 测试均返回 blocked，目标 HEAD 不变 | Harness Git 安全规则 |
| case | Windows 桌面端合并向导的安全 FF 流程 | 可复用流程为：预检→展示 commit/file diff→用户勾选审阅→策略确认→Runtime 二次校验→`--ff-only` | Renderer build、35 tests、Runtime 26 tests | Run/Worktree 操作案例 |

## 不建议沉淀的内容

- 本次具体 Run ID、临时测试目录和单次命令输出：只对当前 Run 有意义。
- 合并抽屉的具体颜色、间距和图标：属于可变 UI 实现细节。
- Vite 大 chunk 警告：并非本次新增，也未在本次解决。
- 非 Fast-forward 隔离 Worktree 方案：尚未实现验证，不能作为已确认知识。

## 待用户确认

- 是否将“Git 写操作双阶段安全模式”推广为其他 Git Commit、Push、Release 和知识库更新操作的统一规则。
- 是否在后续 Run 中实现隔离 Worktree 的非 Fast-forward 合并与冲突中心。

> 本草稿不自动写入共享知识库，等待人工审批。
