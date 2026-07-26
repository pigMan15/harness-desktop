export interface MergeStatusEntry { status: string; path: string; raw: string }
export interface MergeStatus { total: number; entries: MergeStatusEntry[]; truncated: boolean }
export interface MergeCommit { hash: string; subject: string; author: string; authoredAt: string }
export interface MergeFileEntry { status: string; path: string; previousPath?: string; raw: string }
export interface MergeFileList { total: number; entries: MergeFileEntry[]; truncated: boolean }
export interface MergeIssue {
  code: string
  severity: 'blocking' | 'warning'
  title: string
  description: string
  action: string
  details: string[]
}

export interface MergePreflight {
  runId: string
  revision: string
  status: 'ready' | 'blocked' | 'merged'
  canMerge: boolean
  targetBranch: string
  branchName: string
  targetHead: string
  runHead: string
  ahead: number
  behind: number
  fastForward: boolean
  targetStatus: MergeStatus
  runStatus: MergeStatus
  commits: MergeCommit[]
  files: MergeFileList
  fileSummary: { added: number; modified: number; deleted: number; renamed: number; other: number }
  issues: MergeIssue[]
}

const GUIDANCE: Record<string, { title: string; description: string; action: string }> = {
  TARGET_WORKTREE_DIRTY: {
    title: '主项目有尚未保存的修改',
    description: '主项目中的修改还没有保存为一个版本。为了避免覆盖代码，软件不会自动处理这些文件。',
    action: '请先在主项目中保存为版本，或临时保存这些修改，然后重新检查。',
  },
  RUN_WORKTREE_DIRTY: {
    title: '任务工作目录有尚未保存的修改',
    description: '这些修改还没有保存到任务的版本记录中，当前合并可能遗漏内容。',
    action: '打开任务终端，确认需要保留的修改并保存为版本，然后重新检查。',
  },
  NON_FAST_FORWARD: {
    title: '主项目和任务代码都发生了更新',
    description: '两边都包含新的代码版本，软件无法在不做选择的情况下直接组合它们。',
    action: '为了避免覆盖代码，软件不会自动选择保留哪一边。请交给熟悉版本管理的开发人员处理。',
  },
  REVISION_CONFLICT: {
    title: '页面信息已经过期',
    description: '任务代码在页面打开后发生了变化。',
    action: '请重新检查，确认最新内容后再合并。',
  },
}

export function mergeIssueGuidance(code: string): { title: string; description: string; action: string } {
  return GUIDANCE[code] || {
    title: '无法完成合并预检',
    description: '当前 Git 状态不满足安全合并条件。',
    action: '查看技术详情、修复 Git 状态后刷新。',
  }
}

export function canExecuteMerge(preflight?: MergePreflight): boolean {
  return Boolean(preflight?.status === 'ready' && preflight.canMerge && preflight.fastForward && preflight.issues.length === 0)
}
