# Change Request

- 时间：2026-07-25 08:34 +08:00
- 用户指令：跳过 TDD 和编译。
- 解释：不执行测试先行的 Red/Green 循环，不运行 TypeScript typecheck 或生产构建命令。
- Harness 处理：不删除或跳过 `COMPILE` 节点；由 verifier 在 `12-compile.md` 记录用户授权的 `WAIVED`，G3 不标记为 PASS。
- 保留：实现后运行既有 Renderer 单元测试和最小运行态布局核对；本指令未豁免 G4_UNIT_TEST。
- 风险：缺少编译证据可能遗漏类型或 bundler 问题；回滚限定为 Renderer CSS/observer 小改动。
