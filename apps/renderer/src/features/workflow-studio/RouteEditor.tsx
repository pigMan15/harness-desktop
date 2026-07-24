/** Route Editor — select Intent/Risk and preview the compiled route. */
import React from 'react'
import { useWorkflowDraft } from './useWorkflowDraft'

const INTENTS = ['QUERY', 'BUG_FIX', 'FEATURE', 'REFACTOR', 'DEPLOYMENT', 'INCIDENT']
const RISKS = ['NA', 'LOW', 'MEDIUM', 'HIGH']

export function RouteEditor({ onSelect }: { onSelect?: (intent: string, risk: string) => void }): React.ReactElement {
  const { selectedIntent, selectedRisk, setIntent, setRisk } = useWorkflowDraft()

  return (
    <div className="route-selectors">
      <div className="segmented" aria-label="Intent">{INTENTS.map((intent) => <button key={intent} className={selectedIntent === intent ? 'active' : ''} onClick={() => { onSelect?.(intent, selectedRisk); setIntent(intent) }}>{intent}</button>)}</div>
      <div className="segmented" aria-label="Risk">{RISKS.map((risk) => <button key={risk} className={selectedRisk === risk ? 'active' : ''} onClick={() => { onSelect?.(selectedIntent, risk); setRisk(risk) }}>{risk}</button>)}</div>
    </div>
  )
}
