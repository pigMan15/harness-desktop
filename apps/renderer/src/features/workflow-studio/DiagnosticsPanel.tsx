/** Diagnostics Panel — shows compile errors/warnings with pointer to node. */
import React from 'react'
import { useWorkflowDraft } from './useWorkflowDraft'

export function DiagnosticsPanel(): React.ReactElement | null {
  const { diagnostics } = useWorkflowDraft()

  if (diagnostics.length === 0) return null

  return (
    <div style={{ padding: 12, background: '#fff3cd', borderRadius: 4, marginTop: 12 }}>
      <h4 style={{ margin: 0 }}>Diagnostics ({diagnostics.length})</h4>
      {diagnostics.map((d, i) => (
        <div key={i} style={{ padding: '4px 0', color: d.severity === 'error' ? '#721c24' : '#856404' }}>
          [{d.severity.toUpperCase()}] {d.code}: {d.message}
          {d.pointer && <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>{d.pointer}</span>}
        </div>
      ))}
    </div>
  )
}
