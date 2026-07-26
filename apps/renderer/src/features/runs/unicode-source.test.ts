import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))

describe('Runs merge assistant copy', () => {
  it('does not ship literal Unicode escape sequences to JSX text nodes', () => {
    const source = readFileSync(resolve(currentDir, 'RunsPage.tsx'), 'utf8')
    expect(source).not.toMatch(/\\u[0-9a-f]{4}/i)
  })
})
