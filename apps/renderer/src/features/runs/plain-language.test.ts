import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'RunsPage.tsx'), 'utf8')

describe('Run merge plain-language copy', () => {
  it('uses user-facing language for the primary merge flow', () => {
    expect(source).not.toContain('可安全 Fast-forward')
    expect(source).not.toContain('确认 Fast-forward 合并')
    expect(source).not.toContain('Run-only commits')
    expect(source).not.toContain('Target-only commits')
    expect(source).not.toContain('不会修改 HEAD、Index')
    expect(source).toContain('可以安全合并')
    expect(source).toContain('确认合并到主项目')
    expect(source).toContain('此任务新增版本')
    expect(source).toContain('主项目新增版本')
    expect(source).toContain('查看技术详情')
  })
})
