# 开发记录

- 将合并向导标题改为“任务代码合并”。
- 将主要状态改为“可以安全合并 / 暂时不能自动合并”。
- 将 Ahead/Behind、Commit、Merge mode 等表达改为“此任务新增版本、主项目新增版本、版本记录、处理方式”。
- 主按钮改为“确认合并到主项目”。
- 脏工作区和分支分叉提示改为普通用户可理解的操作建议。
- 新增“查看技术详情”，仅在展开后显示 Fast-forward、Target HEAD、Run HEAD。
- 新增 `plain-language.test.ts` 防止主流程重新出现专业术语。
- 未修改 Runtime 或 Git 合并行为。
