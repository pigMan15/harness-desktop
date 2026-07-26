import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { translate } from './LanguageContext'

const features = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('language translations', () => {
  it('returns the selected language immediately', () => {
    expect(translate('zh-CN', 'nav.settings')).toBe('设置')
    expect(translate('en-US', 'nav.settings')).toBe('Settings')
  })

  it('interpolates translated values', () => {
    expect(translate('zh-CN', 'settings.selectedFiles', { count: 3 })).toBe('已选择 3 个文件')
    expect(translate('en-US', 'settings.selectedFiles', { count: 3 })).toBe('3 file(s) selected')
  })

  it('connects language-aware actions across all primary modules', () => {
    for (const path of [
      'projects/ProjectsPage.tsx', 'runs/RunsPage.tsx', 'terminal/TerminalPage.tsx',
      'workflow/WorkflowPage.tsx', 'gates/GatesPage.tsx', 'artifacts/ArtifactsPage.tsx',
      'knowledge/KnowledgePage.tsx', 'execution/ExecutionPage.tsx', 'recovery/RecoveryPage.tsx',
    ]) {
      const source = readFileSync(resolve(features, path), 'utf8')
      expect(source, path).toContain('useLanguage')
      expect(source, path).toContain('text(')
    }
  })
})
