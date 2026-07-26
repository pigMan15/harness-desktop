import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { loadLocalSettings, type AppLanguage } from './settings-policy'

export type TranslationKey = keyof typeof TRANSLATIONS['en-US']

const TRANSLATIONS = {
  'en-US': {
    'nav.projects': 'Projects', 'nav.runs': 'Runs', 'nav.terminal': 'Terminal', 'nav.workflow': 'Workflow',
    'nav.gates': 'Gates', 'nav.artifacts': 'Artifacts', 'nav.knowledge': 'Knowledge', 'nav.recovery': 'Recovery', 'nav.settings': 'Settings',
    'workspace.noProject': 'No project selected', 'workspace.runtime': 'Runtime',
    'settings.title': 'Settings', 'settings.description': 'Configure AI CLI providers, working profiles, policy defaults, release behavior, and diagnostics.',
    'settings.import': 'Import', 'settings.export': 'Export', 'settings.reset': 'Reset',
    'settings.language.title': 'Language', 'settings.language.description': 'Choose the display language. Changes apply immediately and persist after restart.',
    'settings.language.label': 'Interface language', 'settings.language.zh': '简体中文', 'settings.language.en': 'English',
    'settings.providers.title': 'AI CLI Providers', 'settings.providers.description': 'Codex and Claude Code share the same provider-aware terminal protocol.',
    'settings.discover': 'Discover', 'settings.choose': 'Choose', 'settings.savePath': 'Save path', 'settings.default': 'Default',
    'settings.profiles.title': 'Profiles', 'settings.profileName': 'Custom profile name', 'settings.saveCurrent': 'Save current',
    'settings.deleteProfile': 'Delete custom profile',
    'settings.policy.title': 'Policy Engine', 'settings.policy.description': 'Baseline rules shared by AI CLI, terminal, Git, release, and knowledge flows.',
    'settings.commandExecution': 'Command execution', 'settings.gitCommit': 'Git commit', 'settings.gitPush': 'Git push', 'settings.dirtyWorktree': 'Dirty worktree',
    'settings.ask': 'Ask', 'settings.allow': 'Allow', 'settings.block': 'Block', 'settings.repeatKnowledge': 'Allow repeated knowledge push',
    'settings.release.title': 'GitHub Release', 'settings.release.description': 'Probe GitHub CLI, prepare metadata and assets, then create or update a release.',
    'settings.tagPrefix': 'Tag prefix', 'settings.releaseTag': 'Release tag', 'settings.releaseTitle': 'Title', 'settings.releaseNotes': 'Release notes',
    'settings.releaseNotesPlaceholder': 'Changes in this release', 'settings.draft': 'Create draft release', 'settings.overwriteAssets': 'Overwrite same-name assets',
    'settings.assets': 'Assets', 'settings.noAssets': 'No assets selected', 'settings.selectedFiles': '{count} file(s) selected',
    'settings.probe': 'Probe', 'settings.chooseAssets': 'Choose assets', 'settings.publishRelease': 'Publish release', 'settings.openRelease': 'Open release',
    'settings.diagnostics.title': 'Diagnostics', 'settings.diagnostics.description': 'Check the local runtime and AI CLI provider availability from one place.',
    'settings.runDiagnostics': 'Run diagnostics', 'settings.notChecked': 'Not checked yet.',
  },
  'zh-CN': {
    'nav.projects': '项目', 'nav.runs': '运行', 'nav.terminal': '终端', 'nav.workflow': '工作流',
    'nav.gates': '门禁', 'nav.artifacts': '产物', 'nav.knowledge': '知识库', 'nav.recovery': '恢复', 'nav.settings': '设置',
    'workspace.noProject': '未选择项目', 'workspace.runtime': '运行时',
    'settings.title': '设置', 'settings.description': '配置 AI CLI、工作配置、策略默认值、发布行为和诊断工具。',
    'settings.import': '导入', 'settings.export': '导出', 'settings.reset': '重置',
    'settings.language.title': '语言', 'settings.language.description': '选择界面显示语言，修改后立即生效并在重启后保留。',
    'settings.language.label': '界面语言', 'settings.language.zh': '简体中文', 'settings.language.en': 'English',
    'settings.providers.title': 'AI CLI 提供程序', 'settings.providers.description': 'Codex 和 Claude Code 共用同一套终端协议。',
    'settings.discover': '自动发现', 'settings.choose': '选择文件', 'settings.savePath': '保存路径', 'settings.default': '设为默认',
    'settings.profiles.title': '工作配置', 'settings.profileName': '自定义配置名称', 'settings.saveCurrent': '保存当前配置',
    'settings.deleteProfile': '删除自定义配置',
    'settings.policy.title': '策略引擎', 'settings.policy.description': 'AI CLI、终端、Git、发布和知识流程共用的基础规则。',
    'settings.commandExecution': '命令执行', 'settings.gitCommit': 'Git 提交', 'settings.gitPush': 'Git 推送', 'settings.dirtyWorktree': '脏工作区',
    'settings.ask': '询问', 'settings.allow': '允许', 'settings.block': '阻止', 'settings.repeatKnowledge': '允许重复推送知识',
    'settings.release.title': 'GitHub 发布', 'settings.release.description': '检测 GitHub CLI，准备版本信息和附件，然后创建或更新 Release。',
    'settings.tagPrefix': '标签前缀', 'settings.releaseTag': '版本标签', 'settings.releaseTitle': '标题', 'settings.releaseNotes': '发布说明',
    'settings.releaseNotesPlaceholder': '本次发布的变更内容', 'settings.draft': '创建为草稿', 'settings.overwriteAssets': '覆盖同名附件',
    'settings.assets': '附件', 'settings.noAssets': '未选择附件', 'settings.selectedFiles': '已选择 {count} 个文件',
    'settings.probe': '检测', 'settings.chooseAssets': '选择附件', 'settings.publishRelease': '发布版本', 'settings.openRelease': '打开 Release',
    'settings.diagnostics.title': '诊断', 'settings.diagnostics.description': '集中检查本地运行时和 AI CLI 的可用状态。',
    'settings.runDiagnostics': '运行诊断', 'settings.notChecked': '尚未检查',
  },
} as const

interface LanguageValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
  text: (english: string, chinese: string) => string
}

const LanguageContext = createContext<LanguageValue | undefined>(undefined)

export function translate(language: AppLanguage, key: TranslationKey, values?: Record<string, string | number>): string {
  return Object.entries(values || {}).reduce(
    (text, [name, replacement]) => text.replace(`{${name}}`, String(replacement)),
    TRANSLATIONS[language][key] as string,
  )
}

export function LanguageProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [language, setLanguageState] = useState<AppLanguage>(() => loadLocalSettings().language)
  const setLanguage = useCallback((next: AppLanguage) => setLanguageState(next), [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  const value = useMemo<LanguageValue>(() => ({
    language,
    setLanguage,
    t: (key, values) => translate(language, key, values),
    text: (english, chinese) => language === 'zh-CN' ? chinese : english,
  }), [language, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}
