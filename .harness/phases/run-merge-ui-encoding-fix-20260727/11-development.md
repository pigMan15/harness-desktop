# 开发记录

- 根因：JavaScript 字符串中的 `\uXXXX` 会被解析，但 JSX 直接文字节点不会解析，导致界面显示字面量转义。
- 修复：将 `RunsPage.tsx` 中 277 个 Unicode 转义转换为 UTF-8 中文文本。
- 新增：`unicode-source.test.ts`，扫描 Runs 页面源码，禁止再次出现字面量 Unicode 转义。
- 未修改：Runtime 合并逻辑、Git 策略、预检数据结构和页面布局。
- 临时转换脚本执行后已删除。

## TDD

- 初始失败：源码回归测试检测到 `\\u[0-9a-f]{4}`。
- 修复后：测试通过，源码扫描无残留。
