# 追加需求：模块间距统一

## 用户反馈

统一主题上线后，各模块的页面外边距、页头间距、区块间距和卡片间距仍不一致。

## Dispatcher 决策

- 沿用 Run：`unified-ui-refresh-20260727`
- 保持意图：FEATURE
- 保持风险：MEDIUM
- 回退节点：DEVELOPMENT
- 下一角色：developer
- 原因：属于已确认统一 UI 方案的范围内修正，不改变原始需求和设计；源码继续变更，因此必须重新执行 G3、G4、G6、G8。

## 修正范围

- 通过主题设计令牌统一常规页面的水平/垂直 padding。
- 统一 `.page-header`、主要面板、卡片网格和连续区块之间的 gap/margin。
- 移除 Knowledge 等页面对通用页面 padding 的冲突覆盖。
- Terminal、Artifacts、Workflow Studio 等高度敏感工作台保留结构性例外，但其外层起始边距与通用页面对齐。
- 不修改业务组件、数据流和 Terminal 核心尺寸逻辑。

## 验收标准

- 桌面宽度下，主要模块使用同一页面水平 padding 和页头底部间距。
- 900px 与 680px 以下使用统一窄屏 padding，不再由单个模块重复覆盖。
- 卡片/面板网格的基础 gap 使用统一间距令牌。
- 主题契约测试能够检查上述间距令牌和关键页面映射。
- Renderer 类型检查、测试和生产构建重新通过。
