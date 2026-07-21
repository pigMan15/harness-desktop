import React from 'react'
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/projects', label: 'Projects', icon: '📁' },
  { to: '/runs', label: 'Runs', icon: '▶' },
  { to: '/workflow', label: 'Workflow', icon: '🔀' },
  { to: '/gates', label: 'Gates', icon: '🛡' },
]

export function Sidebar(): React.ReactElement {
  return (
    <nav style={{ width: 180, background: '#1e1e2e', color: '#cdd6f4', padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 14 }}>Harness Desktop</h3>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          style={({ isActive }) => ({
            padding: '8px 12px', borderRadius: 6, textDecoration: 'none', color: isActive ? '#fff' : '#a6adc8',
            background: isActive ? '#45475a' : 'transparent', fontSize: 14,
          })}
        >
          {n.icon} {n.label}
        </NavLink>
      ))}
    </nav>
  )
}
