import React from 'react'
import { NavLink } from 'react-router-dom'
import { Boxes, FileText, FolderKanban, KeyRound, RotateCcw, Settings, ShieldCheck, SquareTerminal, Workflow } from 'lucide-react'

const NAV = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/runs', label: 'Runs', icon: Boxes },
  { to: '/execution', label: 'Terminal', icon: SquareTerminal },
  { to: '/workflow', label: 'Workflow', icon: Workflow },
  { to: '/gates', label: 'Gates', icon: ShieldCheck },
  { to: '/artifacts', label: 'Artifacts', icon: FileText },
  { to: '/knowledge', label: 'Knowledge', icon: KeyRound },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw },
  { to: '/settings/codex', label: 'Settings', icon: Settings },
]

export function Sidebar(): React.ReactElement {
  return (
    <nav className="sidebar">
      <div className="brand"><strong>H</strong><span>Harness Desktop</span></div>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={label}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
