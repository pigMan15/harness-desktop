import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Clock3, FileText, PlayCircle, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../layout/WorkspaceContext'
import { useLanguage } from '../settings/LanguageContext'
import './gates.css'

type GateStatus = 'PASS' | 'FAIL' | 'WAIVED' | 'BLOCKED' | 'NOT_REQUIRED' | 'NOT_RUN'
interface Definition { meaning?: string; description?: string; required_artifacts?: string[]; pass_conditions?: string[] }
interface Context {
  runId: string; currentNode: string; nextRole: string; revision: string
  gates: Record<string, GateStatus>; definitions: Record<string, Definition>
  waivers: Record<string, { scope: string; reason: string; owner: string; time: string }>
}
interface Result { status: GateStatus; reason: string; retry_target?: string | null; revision?: string; gates?: Record<string, GateStatus>; currentNode?: string; nextRole?: string }

const ORDER = ['G1_REQUIREMENTS', 'G2_DESIGN', 'G3_COMPILE', 'G4_UNIT_TEST', 'G5_ATDD', 'G6_EVIDENCE', 'G7_PRERELEASE', 'G8_ACCEPTANCE']
const GROUPS = [
  [['Requirements & Design', '\u9700\u6c42\u4e0e\u8bbe\u8ba1'], ['G1_REQUIREMENTS', 'G2_DESIGN']],
  [['Engineering Quality', '\u5de5\u7a0b\u8d28\u91cf'], ['G3_COMPILE', 'G4_UNIT_TEST', 'G5_ATDD']],
  [['Evidence & Acceptance', '\u8bc1\u636e\u4e0e\u9a8c\u6536'], ['G6_EVIDENCE', 'G7_PRERELEASE', 'G8_ACCEPTANCE']],
] as Array<[[string, string], string[]]>
const NAMES: Record<string, [string, string]> = {
  G1_REQUIREMENTS: ['Requirements', '\u9700\u6c42\u786e\u8ba4'], G2_DESIGN: ['Design', '\u65b9\u6848\u8bbe\u8ba1'],
  G3_COMPILE: ['Compile', '\u7f16\u8bd1\u68c0\u67e5'], G4_UNIT_TEST: ['Unit test', '\u5355\u5143\u6d4b\u8bd5'],
  G5_ATDD: ['ATDD', '\u573a\u666f\u9a8c\u6536'], G6_EVIDENCE: ['Evidence', '\u8bc1\u636e\u5b8c\u6574\u6027'],
  G7_PRERELEASE: ['Prerelease', '\u9884\u53d1\u9a8c\u8bc1'], G8_ACCEPTANCE: ['Acceptance', '\u6700\u7ec8\u9a8c\u6536'],
}
const RETRY: Record<string, string> = {
  G1_REQUIREMENTS: 'REQUIREMENT_REVIEW', G2_DESIGN: 'SOLUTION_DESIGN', G3_COMPILE: 'DEVELOPMENT',
  G4_UNIT_TEST: 'DEVELOPMENT', G5_ATDD: 'DEVELOPMENT', G6_EVIDENCE: 'EVIDENCE_CAPTURE',
  G7_PRERELEASE: 'PRERELEASE_DEPLOYMENT', G8_ACCEPTANCE: 'ACCEPTANCE_REPORT',
}

const VERIFIER_ONLY = new Set(['G3_COMPILE', 'G4_UNIT_TEST', 'G5_ATDD', 'G6_EVIDENCE', 'G7_PRERELEASE', 'G8_ACCEPTANCE'])
function tone(status: GateStatus): string {
  if (status === 'PASS') return 'success'
  if (status === 'FAIL' || status === 'BLOCKED') return 'danger'
  if (status === 'WAIVED') return 'warning'
  return ''
}
function Icon({ status }: { status: GateStatus }): React.ReactElement {
  if (status === 'PASS') return <CheckCircle2 size={17} />
  if (status === 'FAIL') return <AlertTriangle size={17} />
  if (status === 'BLOCKED') return <Ban size={17} />
  if (status === 'WAIVED') return <ShieldCheck size={17} />
  return <Clock3 size={17} />
}

export function GatesDashboard(): React.ReactElement {
  const { text } = useLanguage()
  const navigate = useNavigate()
  const { selectedProjectId, activeRun } = useWorkspace()
  const [context, setContext] = useState<Context>()
  const [artifacts, setArtifacts] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<Record<string, Result>>({})
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState('')
  const [batch, setBatch] = useState(false)
  const [message, setMessage] = useState('')
  const [waiving, setWaiving] = useState(false)
  const [waiver, setWaiver] = useState({ scope: '', reason: '', owner: '' })

  const refresh = useCallback(async () => {
    if (!window.harness || !activeRun) { setContext(undefined); setArtifacts(new Set()); return }
    try {
      const values = await Promise.all([
        window.harness.listGates(selectedProjectId, activeRun.run_id),
        window.harness.listArtifacts(selectedProjectId, activeRun.run_id),
      ])
      if (values[0].error) throw new Error(String(values[0].error))
      setContext(values[0] as unknown as Context)
      setArtifacts(new Set(Array.isArray(values[1]) ? values[1].map((item) => String((item as { name?: string }).name || '')) : []))
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : text('Gate load failed', '\u95e8\u7981\u52a0\u8f7d\u5931\u8d25')) }
  }, [activeRun, selectedProjectId, text])

  useEffect(() => { void refresh() }, [refresh])
  const ids = useMemo(() => {
    const configured = Object.keys(context?.definitions || {})
    return ORDER.filter((id) => configured.includes(id)).concat(configured.filter((id) => !ORDER.includes(id)))
  }, [context?.definitions])
  const counts = useMemo(() => ids.reduce<Record<GateStatus, number>>((all, id) => {
    all[context?.gates[id] || 'NOT_RUN'] += 1
    return all
  }, { PASS: 0, FAIL: 0, WAIVED: 0, BLOCKED: 0, NOT_REQUIRED: 0, NOT_RUN: 0 }), [context?.gates, ids])
  const complete = counts.PASS + counts.FAIL + counts.WAIVED + counts.BLOCKED + counts.NOT_REQUIRED
  const percent = ids.length ? Math.round(complete / ids.length * 100) : 0
  const blocking = ids.find((id) => ['FAIL', 'BLOCKED'].includes(context?.gates[id] || ''))
  const definition = context?.definitions[selectedId]
  const status = context?.gates[selectedId] || 'NOT_RUN'
  const result = results[selectedId]
  const hasPermission = (id: string): boolean => !VERIFIER_ONLY.has(id) || context?.nextRole === 'verifier'
  const waiverStatusAllowed = ['NOT_RUN', 'FAIL', 'BLOCKED'].includes(status)
  const canWaive = Boolean(context && hasPermission(selectedId) && waiverStatusAllowed)
  const restrictionReason = !hasPermission(selectedId)
    ? text('Only verifier can operate G3-G8. Current role: ', 'G3-G8 \u4ec5\u5141\u8bb8 verifier \u64cd\u4f5c\u3002\u5f53\u524d\u89d2\u8272\uff1a') + (context?.nextRole || '-')
    : text('This status does not need a waiver.', '\u5f53\u524d\u72b6\u6001\u4e0d\u9700\u8981\u8c41\u514d\u3002')

  async function call(id: string, revision: string): Promise<Result> {
    if (!window.harness || !context) throw new Error('GATE_CONTEXT_MISSING')
    const value = await window.harness.evaluateGate(selectedProjectId, context.runId, id, revision)
    if (value.error) throw new Error(String(value.error))
    return value as unknown as Result
  }
  async function evaluate(id: string): Promise<void> {
    if (!context) return
    setBusy(id)
    try {
      const value = await call(id, context.revision)
      setResults((all) => ({ ...all, [id]: value }))
      setMessage(id + ': ' + value.status + ' - ' + value.reason)
      await refresh()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : text('Gate evaluation failed', '\u95e8\u7981\u8bc4\u4f30\u5931\u8d25')) }
    finally { setBusy('') }
  }
  async function evaluatePending(): Promise<void> {
    if (!context) return
    setBatch(true)
    let revision = context.revision
    let current = context
    try {
      for (const id of ids) {
        const state = current.gates[id] || 'NOT_RUN'
        if (state !== 'NOT_RUN' && state !== 'FAIL') continue
        setBusy(id)
        const value = await call(id, revision)
        setResults((all) => ({ ...all, [id]: value }))
        revision = value.revision || revision
        current = { ...current, revision, currentNode: value.currentNode || current.currentNode, nextRole: value.nextRole || current.nextRole, gates: value.gates || { ...current.gates, [id]: value.status } }
        setContext(current)
        if (value.status === 'FAIL' || value.status === 'BLOCKED') {
          setSelectedId(id)
          setMessage(text('Batch evaluation stopped at ', '\u6279\u91cf\u8bc4\u4f30\u505c\u6b62\u4e8e ') + id + ': ' + value.reason)
          return
        }
      }
      setMessage(text('All pending gates were evaluated in order.', '\u6240\u6709\u5f85\u6267\u884c\u95e8\u7981\u5df2\u6309\u987a\u5e8f\u5b8c\u6210\u8bc4\u4f30\u3002'))
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : text('Batch evaluation failed', '\u6279\u91cf\u8bc4\u4f30\u5931\u8d25')) }
    finally { setBusy(''); setBatch(false); await refresh() }
  }
  async function submitWaiver(): Promise<void> {
    if (!window.harness || !context || !selectedId) return
    setBusy(selectedId)
    try {
      const value = await window.harness.waiveGate(selectedProjectId, context.runId, selectedId, waiver.scope, waiver.reason, waiver.owner, context.revision)
      if (value.error) throw new Error(String(value.error))
      setWaiving(false); setWaiver({ scope: '', reason: '', owner: '' }); await refresh()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : text('Gate waiver failed', '\u95e8\u7981\u8c41\u514d\u5931\u8d25')) }
    finally { setBusy('') }
  }
  function openArtifact(name: string): void {
    if (!context) return
    localStorage.setItem('harness.artifacts.selection.' + selectedProjectId + '.' + context.runId, name)
    navigate('/artifacts')
  }
  function card(id: string): React.ReactElement | null {
    const item = context?.definitions[id]
    if (!item) return null
    const gateStatus = context?.gates[id] || 'NOT_RUN'
    const required = item.required_artifacts || []
    const found = required.filter((name) => artifacts.has(name)).length
    return <article key={id} className={'gate-card ' + tone(gateStatus)} onClick={() => { setSelectedId(id); setWaiving(false) }}>
      <div className="gate-card-head"><span className={'gate-status-icon ' + tone(gateStatus)}><Icon status={gateStatus} /></span><div><strong>{text(...(NAMES[id] || [id, id]))}</strong><code>{id}</code></div><span className={'badge ' + tone(gateStatus)}>{gateStatus}</span></div>
      <p>{item.meaning || item.description || id}</p>
      <div className="gate-evidence-meter"><span>{text('Evidence', '\u8bc1\u636e')} {found}/{required.length}</span><strong className={found === required.length ? 'success-text' : 'warning-text'}>{found === required.length ? text('complete', '\u5b8c\u6574') : text('missing', '\u7f3a\u5931')}</strong></div>
      {results[id]?.reason && <div className="gate-last-result">{results[id].reason}</div>}
      <div className="gate-card-actions"><button className="button" title={!hasPermission(id) ? text('Only verifier can operate G3-G8. Current role: ', 'G3-G8 \u4ec5\u5141\u8bb8 verifier \u64cd\u4f5c\u3002\u5f53\u524d\u89d2\u8272\uff1a') + (context?.nextRole || '-') : ''} disabled={Boolean(busy) || gateStatus === 'NOT_REQUIRED' || !hasPermission(id)} onClick={(event) => { event.stopPropagation(); void evaluate(id) }}>{busy === id ? text('Evaluating...', '\u8bc4\u4f30\u4e2d...') : text('Evaluate', '\u8bc4\u4f30')}</button><button className="button" onClick={(event) => { event.stopPropagation(); setSelectedId(id) }}>{text('Details', '\u8be6\u60c5')}<ChevronRight size={14} /></button></div>
    </article>
  }

  return <section className="page gates-dashboard">
    <header className="page-header"><div><h1>{text('Quality Gates', '\u8d28\u91cf\u95e8\u7981')}</h1><span className="muted">{text('Review decisions, evidence completeness, and recovery guidance.', '\u96c6\u4e2d\u67e5\u770b\u8d28\u91cf\u5224\u5b9a\u3001\u8bc1\u636e\u5b8c\u6574\u6027\u548c\u5931\u8d25\u6062\u590d\u5efa\u8bae\u3002')}</span></div><div className="actions"><button className="button icon-button" onClick={() => void refresh()} title={text('Refresh gates', '\u5237\u65b0\u95e8\u7981')}><RefreshCw size={15} /></button><button className="button primary" disabled={!context || batch || Boolean(busy)} onClick={() => void evaluatePending()}><PlayCircle size={15} />{batch ? text('Evaluating...', '\u8bc4\u4f30\u4e2d...') : text('Evaluate pending', '\u8bc4\u4f30\u5f85\u6267\u884c\u9879')}</button></div></header>
    {message && <div className="notice">{message}</div>}
    {!activeRun && <div className="empty-state"><h2>{text('Select a run', '\u9009\u62e9\u4e00\u4e2a\u8fd0\u884c')}</h2><p>{text('Select a run to inspect its gates.', '\u9009\u62e9\u8fd0\u884c\u540e\u67e5\u770b\u5bf9\u5e94\u95e8\u7981\u3002')}</p></div>}
    {context && <>
      <section className="gate-overview"><div className="gate-overview-main"><div><span>{text('Gate completion', '\u95e8\u7981\u5b8c\u6210\u5ea6')}</span><strong>{complete}/{ids.length}</strong></div><div className="gate-progress"><span style={{ width: percent + '%' }} /></div><small>{percent}% - {blocking ? text('Blocked by ', '\u5f53\u524d\u963b\u585e\uff1a') + blocking : text('No failed gate', '\u5f53\u524d\u65e0\u5931\u8d25\u95e8\u7981')}</small></div><div className="gate-count-grid">{(['PASS', 'FAIL', 'NOT_RUN', 'WAIVED', 'BLOCKED', 'NOT_REQUIRED'] as GateStatus[]).map((item) => <div key={item}><span className={'gate-count-dot ' + tone(item)} /><small>{item}</small><strong>{counts[item]}</strong></div>)}</div><div className="gate-run-context"><span><small>Run</small><strong className="mono">{context.runId}</strong></span><span><small>Node</small><strong>{context.currentNode}</strong></span><span><small>Role</small><strong>{context.nextRole}</strong></span><span><small>Revision</small><strong className="mono">{context.revision.slice(0, 10)}</strong></span></div></section>
      <section className="gate-timeline">{ids.map((id, index) => <React.Fragment key={id}><button className={tone(context.gates[id] || 'NOT_RUN') + (selectedId === id ? ' active' : '')} title={id} onClick={() => setSelectedId(id)}><Icon status={context.gates[id] || 'NOT_RUN'} /><span>{id.split('_')[0]}</span></button>{index < ids.length - 1 && <i />}</React.Fragment>)}</section>
      <div className="gate-groups">{GROUPS.map((group) => <section key={group[1][0]} className="gate-group"><div className="gate-group-title"><h2>{text(group[0][0], group[0][1])}</h2><span>{group[1].filter((id) => context.definitions[id]).length}</span></div><div className="gate-card-grid">{group[1].map(card)}</div></section>)}</div>
    </>}
    {selectedId && context && definition && <div className="gate-drawer-backdrop" onMouseDown={() => setSelectedId('')}><aside className="gate-drawer" onMouseDown={(event) => event.stopPropagation()}>
      <div className="gate-drawer-head"><div><span className={'gate-status-icon ' + tone(status)}><Icon status={status} /></span><div><h2>{text(...(NAMES[selectedId] || [selectedId, selectedId]))}</h2><code>{selectedId}</code></div></div><button className="button icon-button" onClick={() => setSelectedId('')} title={text('Close details', '\u5173\u95ed\u8be6\u60c5')}><X size={16} /></button></div>
      <div className="gate-detail-status"><span className={'badge ' + tone(status)}>{status}</span><p>{definition.meaning || definition.description}</p></div>
      {result && <section className="gate-detail-section"><h3>{text('Latest evaluation', '\u6700\u8fd1\u8bc4\u4f30')}</h3><div className={'gate-result-box ' + tone(result.status)}><strong>{result.status}</strong><p>{result.reason}</p></div></section>}
      <section className="gate-detail-section"><h3>{text('Required evidence', '\u5fc5\u9700\u8bc1\u636e')}</h3><div className="gate-artifact-list">{(definition.required_artifacts || []).map((name) => <button key={name} onClick={() => openArtifact(name)}><FileText size={15} /><span><strong>{name}</strong><small>{artifacts.has(name) ? text('Available - open preview', '\u5df2\u5b58\u5728 - \u6253\u5f00\u9884\u89c8') : text('Missing from phase artifacts', '\u9636\u6bb5\u4ea7\u7269\u4e2d\u7f3a\u5931')}</small></span><span className={'badge ' + (artifacts.has(name) ? 'success' : 'danger')}>{artifacts.has(name) ? 'OK' : 'MISSING'}</span></button>)}</div></section>
      {definition.pass_conditions?.length ? <section className="gate-detail-section"><h3>{text('Pass conditions', '\u901a\u8fc7\u6761\u4ef6')}</h3><ul>{definition.pass_conditions.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
      {['FAIL', 'BLOCKED'].includes(status) && <section className="gate-detail-section gate-recovery"><h3>{text('Recovery guidance', '\u6062\u590d\u5efa\u8bae')}</h3><p>{text('Repair the failed check or missing evidence, then evaluate this gate again.', '\u4fee\u590d\u5931\u8d25\u68c0\u67e5\u6216\u8865\u9f50\u7f3a\u5931\u8bc1\u636e\uff0c\u7136\u540e\u91cd\u65b0\u8bc4\u4f30\u8be5\u95e8\u7981\u3002')}</p><div><small>{text('Suggested node', '\u5efa\u8bae\u8282\u70b9')}</small><strong>{result?.retry_target || RETRY[selectedId] || 'DEVELOPMENT'}</strong></div></section>}
      {context.waivers[selectedId] && <section className="gate-detail-section"><h3>{text('Waiver record', '\u8c41\u514d\u8bb0\u5f55')}</h3><p>{context.waivers[selectedId].owner}: {context.waivers[selectedId].reason}</p></section>}
      {!canWaive && <div className="gate-permission-note"><ShieldCheck size={16} /><div><strong>{!hasPermission(selectedId) ? text('Verifier permission required', '\u9700\u8981 verifier \u6743\u9650') : text('Waiver not applicable', '\u5f53\u524d\u65e0\u9700\u8c41\u514d')}</strong><span>{restrictionReason}</span></div></div>}
      {waiving && canWaive ? <section className="gate-detail-section gate-waiver-form"><h3>{text('Record waiver', '\u8bb0\u5f55\u8c41\u514d')}</h3><label>{text('Scope', '\u8303\u56f4')}<input value={waiver.scope} onChange={(event) => setWaiver({ ...waiver, scope: event.target.value })} /></label><label>{text('Reason', '\u539f\u56e0')}<textarea value={waiver.reason} onChange={(event) => setWaiver({ ...waiver, reason: event.target.value })} /></label><label>{text('Owner', '\u8d1f\u8d23\u4eba')}<input value={waiver.owner} onChange={(event) => setWaiver({ ...waiver, owner: event.target.value })} /></label><div className="actions"><button className="button danger" disabled={!waiver.scope || !waiver.reason || !waiver.owner || Boolean(busy)} onClick={() => void submitWaiver()}>{text('Confirm waiver', '\u786e\u8ba4\u8c41\u514d')}</button><button className="button" onClick={() => setWaiving(false)}>{text('Cancel', '\u53d6\u6d88')}</button></div></section> : <div className="gate-drawer-actions"><button className="button primary" title={!hasPermission(selectedId) ? restrictionReason : ''} disabled={Boolean(busy) || status === 'NOT_REQUIRED' || !hasPermission(selectedId)} onClick={() => void evaluate(selectedId)}>{text('Evaluate gate', '\u8bc4\u4f30\u95e8\u7981')}</button>{canWaive && <button className="button" disabled={Boolean(busy)} onClick={() => setWaiving(true)}>{text('Create waiver', '\u521b\u5efa\u8c41\u514d')}</button>}</div>}
    </aside></div>}
  </section>
}
