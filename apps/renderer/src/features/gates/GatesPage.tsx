import React, { useState } from 'react'

const GATE_NAMES: Record<string, string> = {
  G1_REQUIREMENTS: 'Requirements',
  G2_DESIGN: 'Design',
  G3_COMPILE: 'Compile',
  G4_UNIT_TEST: 'Unit Test',
  G5_ATDD: 'ATDD',
  G6_EVIDENCE: 'Evidence',
  G7_PRERELEASE: 'Prerelease',
  G8_ACCEPTANCE: 'Acceptance',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PASS: { bg: '#d4edda', color: '#155724' },
  FAIL: { bg: '#f8d7da', color: '#721c24' },
  BLOCKED: { bg: '#f8d7da', color: '#721c24' },
  NOT_RUN: { bg: '#e2e3e5', color: '#383d41' },
  NOT_REQUIRED: { bg: '#e2e3e5', color: '#6c757d' },
  WAIVED: { bg: '#fff3cd', color: '#856404' },
}

export function GatesPage(): React.ReactElement {
  const [gates, setGates] = useState<Record<string, string>>({})

  async function loadGates() {
    try {
      const result = await window.harness!.listGates('local')
      if (result?.gates) setGates(result.gates)
    } catch { /* ignore */ }
  }

  React.useEffect(() => { loadGates() }, [])

  return (
    <div style={{ padding: 24 }}>
      <h2>Quality Gates</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
        {Object.entries(GATE_NAMES).map(([id, name]) => {
          const status = gates[id] || 'NOT_RUN'
          const c = STATUS_COLORS[status] || STATUS_COLORS.NOT_RUN
          return (
            <div key={id} style={{ padding: 16, borderRadius: 8, background: c.bg, color: c.color }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{id}</div>
              <div style={{ fontSize: 16, fontWeight: 600, margin: '4px 0' }}>{name}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{status}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
