import React from 'react'
import { NavLink } from 'react-router-dom'
import { Boxes, FileText, FolderKanban, KeyRound, RotateCcw, Settings, ShieldCheck, SquareTerminal, Workflow } from 'lucide-react'
import { useLanguage } from '../settings/LanguageContext'

const NAV = [
  { to: '/projects', label: 'nav.projects' as const, icon: FolderKanban },
  { to: '/runs', label: 'nav.runs' as const, icon: Boxes },
  { to: '/execution', label: 'nav.terminal' as const, icon: SquareTerminal },
  { to: '/workflow', label: 'nav.workflow' as const, icon: Workflow },
  { to: '/gates', label: 'nav.gates' as const, icon: ShieldCheck },
  { to: '/artifacts', label: 'nav.artifacts' as const, icon: FileText },
  { to: '/knowledge', label: 'nav.knowledge' as const, icon: KeyRound },
  { to: '/recovery', label: 'nav.recovery' as const, icon: RotateCcw },
  { to: '/settings/codex', label: 'nav.settings' as const, icon: Settings },
]

export function Sidebar(): React.ReactElement {
  const { t } = useLanguage()
  return (
    <nav className="sidebar">
      <div className="brand"><strong>H</strong><span>Harness Desktop</span></div>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={t(label)}>
          <Icon size={17} aria-hidden="true" /><span>{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
