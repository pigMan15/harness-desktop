import { describe, expect, it } from 'vitest'
import { canExecuteMerge, mergeIssueGuidance, type MergePreflight } from './merge-assistant'

const ready: MergePreflight = {
  runId: 'run-1', revision: 'rev-1', status: 'ready', canMerge: true,
  targetBranch: 'main', branchName: 'codex/run-1', targetHead: 'a', runHead: 'b',
  ahead: 2, behind: 0, fastForward: true,
  targetStatus: { total: 0, entries: [], truncated: false },
  runStatus: { total: 0, entries: [], truncated: false },
  commits: [], files: { total: 0, entries: [], truncated: false },
  fileSummary: { added: 0, modified: 0, deleted: 0, renamed: 0, other: 0 }, issues: [],
}

describe('Run merge assistant', () => {
  it('only enables execution for a clean fast-forward preflight', () => {
    expect(canExecuteMerge(ready)).toBe(true)
    expect(canExecuteMerge({ ...ready, canMerge: false, status: 'blocked' })).toBe(false)
    expect(canExecuteMerge({ ...ready, fastForward: false })).toBe(false)
    expect(canExecuteMerge({ ...ready, issues: [{ code: 'NON_FAST_FORWARD', severity: 'blocking', title: '', description: '', action: '', details: [] }] })).toBe(false)
  })

  it('provides actionable Chinese guidance for known Git states', () => {
    expect(mergeIssueGuidance('TARGET_WORKTREE_DIRTY').title).toContain('\u4e3b\u9879\u76ee')
    expect(mergeIssueGuidance('RUN_WORKTREE_DIRTY').action).toContain('任务终端')
    expect(mergeIssueGuidance('NON_FAST_FORWARD').action).toContain('开发人员')
    expect(mergeIssueGuidance('REVISION_CONFLICT').action).toContain('\u91cd\u65b0\u68c0\u67e5')
  })
})
