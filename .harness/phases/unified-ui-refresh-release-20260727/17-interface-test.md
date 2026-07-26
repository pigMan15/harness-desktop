# 接口检查记录

## 检查项

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 版本文件 | PASS | `apps/desktop/package.json` 为 `0.2.1` |
| Forge appVersion | PASS | `apps/desktop/forge.config.ts` 为 `0.2.1` |
| 安装包存在 | PASS | `Harness Desktop-0.2.1 Setup.exe` 已生成 |
| Squirrel 包存在 | PASS | `harness-desktop-0.2.1-full.nupkg` 已生成 |
| RELEASES 文件存在 | PASS | `RELEASES` 已生成 |
| 哈希可追踪 | PASS | 三个发布产物均已记录 SHA256 |

## 产物哈希

- `Harness Desktop-0.2.1 Setup.exe`
  - 大小：144465408 bytes
  - SHA256：`C9E8F2ED5D8448BB5D05037136028236C6935D302723C3EE9B7D6C92F6F992E9`
- `harness-desktop-0.2.1-full.nupkg`
  - 大小：143813635 bytes
  - SHA256：`ABE6FF81934900821596E2C063A254362A1B1777181B4D7A2DE32DEABE6F18AA`
- `RELEASES`
  - 大小：86 bytes
  - SHA256：`790F247F36A8C78959096111579C2704E6D281AB0084D8CD49F22D7A588C7387`

## 门禁结论

- `G7_PRERELEASE = PASS`
