/** Route Editor — select Intent/Risk and preview the compiled route. */
import React from 'react'
import { useWorkflowDraft } from './useWorkflowDraft'

const INTENTS = ['QUERY', 'BUG_FIX', 'FEATURE', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

export function RouteEditor(): React.ReactElement {
  const { selectedIntent, selectedRisk, setIntent, setRisk } = useWorkflowDraft()

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
      <label>
        Intent:{' '}
        <select value={selectedIntent} onChange={(e) => setIntent(e.target.value)}>
          {INTENTS.map((i) => (<option key={i} value={i}>{i}</option>))}
        </select>
      </label>
      <label>
        Risk:{' '}
        <select value={selectedRisk} onChange={(e) => setRisk(e.target.value)}>
          {RISKS.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
      </label>
    </div>
  )
}
