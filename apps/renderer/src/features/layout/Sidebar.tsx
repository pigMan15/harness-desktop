import React from 'react'
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/projects', label: 'Projects', icon: 'PR' },
  { to: '/runs', label: 'Tasks', icon: 'TS' },
  { to: '/workflow', label: 'Workflow', icon: 'WF' },
  { to: '/gates', label: 'Gates', icon: 'GT' },
  { to: '/execution', label: 'Execution', icon: 'EX' },
  { to: '/artifacts', label: 'Artifacts', icon: 'AR' },
  { to: '/knowledge', label: 'Knowledge', icon: 'KN' },
  { to: '/recovery', label: 'Recovery', icon: 'RC' },
]

export function Sidebar(): React.ReactElement {
  return (
    <nav className="sidebar">
      <div className="brand"><strong>H</strong><span>Harness Desktop</span></div>
      {NAV.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={label}>
          <strong style={{ width: 20, fontSize: 10 }}>{icon}</strong><span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
