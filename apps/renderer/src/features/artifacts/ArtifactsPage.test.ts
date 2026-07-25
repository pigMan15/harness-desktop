import { describe, expect, it } from 'vitest'
import { formatArtifactSize } from './ArtifactsPage'

describe('formatArtifactSize', () => {
  it('formats bytes without decimals', () => {
    expect(formatArtifactSize(512)).toBe('512 B')
  })

  it('formats small and large kilobyte values consistently', () => {
    expect(formatArtifactSize(1536)).toBe('1.5 KB')
    expect(formatArtifactSize(24 * 1024)).toBe('24 KB')
  })

  it('formats megabytes and rejects invalid input', () => {
    expect(formatArtifactSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
    expect(formatArtifactSize(undefined)).toBe('Unknown size')
  })
})
