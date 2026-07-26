import { describe, expect, it } from 'vitest'
import { buildReleaseCreateArgs, validateReleaseTag } from '../src/main/github-release'

describe('GitHub release commands', () => {
  it('rejects unsafe tags', () => {
    expect(() => validateReleaseTag('../bad')).toThrow('RELEASE_TAG_INVALID')
    expect(() => validateReleaseTag('v1.2.3;whoami')).toThrow('RELEASE_TAG_INVALID')
  })

  it('builds argument arrays without shell interpolation', () => {
    const args = buildReleaseCreateArgs({ tag: 'v0.3.0', title: 'Harness Desktop 0.3.0', notes: 'line one\nline two', assets: ['C:/build/Harness Setup.exe'], draft: true, overwriteAssets: true })
    expect(args).toContain('C:/build/Harness Setup.exe')
    expect(args).toContain('line one\nline two')
    expect(args).toContain('--draft')
    expect(args.join(' ')).not.toContain('cmd /c')
  })
})
