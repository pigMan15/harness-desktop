import React, { useEffect, useState } from 'react'

const GATE_INFO: Record<string, { name: string; meaning: string }> = {
  G1_REQUIREMENTS: { name: 'Requirements', meaning: '范围和验收标准明确' },
  G2_DESIGN: { name: 'Design', meaning: '设计、风险、回滚和实施计划已存在' },
  G3_COMPILE: { name: 'Compile', meaning: '代码已编译或静态检查已通过' },
  G4_UNIT_TEST: { name: 'Unit Test', meaning: '单元测试通过或豁免已记录' },
  G5_ATDD: { name: 'ATDD', meaning: '集成或场景验证已完成' },
  G6_EVIDENCE: { name: 'Evidence', meaning: '证据文件完整（九字段）' },
  G7_PRERELEASE: { name: 'Prerelease', meaning: '预发部署和接口测试已完成' },
  G8_ACCEPTANCE: { name: 'Acceptance', meaning: '验收报告完整' },
}
const COLORS: Record<string, { bg: string; color: string }> = {
  PASS: { bg: '#d4edda', color: '#155724' }, FAIL: { bg: '#f8d7da', color: '#721c24' },
  BLOCKED: { bg: '#f8d7da', color: '#721c24' }, NOT_RUN: { bg: '#e2e3e5', color: '#383d41' },
  NOT_REQUIRED: { bg: '#e2e3e5', color: '#6c757d' }, WAIVED: { bg: '#fff3cd', color: '#856404' },
}

export function GatesPage(): React.ReactElement {
  const [gates, setGates] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function refresh() {
    try {
      const r = await window.harness!.listGates('local')
      if (r?.gates) setGates(r.gates)
      else setMsg(r?.error || 'Failed to load gates')
    } catch (e: any) { setMsg(e.message) }
  }

  useEffect(() => { refresh() }, [])

  async function setGate(id: string, status: string) {
    setMsg(`${id} → ${status}...`)
    try {
      const r = await window.harness!.evaluateGate(id, status)
      if (r && !r.error) {
        setGates(prev => ({ ...prev, [id]: status }))
        setMsg(`${id} → ${status} OK`)
      } else {
        setMsg(`Failed: ${r?.error || 'unknown'}`)
      }
    } catch (e: any) { setMsg(`Error: ${e.message}`) }
  }

  const passCount = Object.values(gates).filter(s => s === 'PASS').length
  const failCount = Object.values(gates).filter(s => s === 'FAIL' || s === 'BLOCKED').length

  return (
    <div style={{ padding: 24 }}>
      <h2>Quality Gates</h2>
      <div style={{ display: 'flex', gap: 16, margin: '12px 0', alignItems: 'center' }}>
        <span style={{ padding: '4px 12px', background: '#d4edda', borderRadius: 4 }}>PASS: {passCount}</span>
        <span style={{ padding: '4px 12px', background: '#f8d7da', borderRadius: 4 }}>FAIL: {failCount}</span>
        <button onClick={refresh} style={{ padding: '6px 14px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 6 }}>Refresh</button>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#666', margin: '4px 0' }}>{msg}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
        {Object.entries(GATE_INFO).map(([id, info]) => {
          const status = gates[id] || 'NOT_RUN'
          const c = COLORS[status] || COLORS.NOT_RUN
          const open = selected === id
          return (
            <div key={id} onClick={() => setSelected(open ? null : id)}
              style={{ padding: 14, borderRadius: 8, background: c.bg, color: c.color, cursor: 'pointer', border: open ? '2px solid #333' : '2px solid transparent' }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{id}</div>
              <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0' }}>{info.name}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{status}</div>
              {open && (
                <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.9)', borderRadius: 6, color: '#333' }}>
                  <p style={{ fontSize: 12, margin: '0 0 8px 0' }}>{info.meaning}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['PASS', 'FAIL', 'WAIVED', 'BLOCKED'].map(action => (
                      <button key={action} onClick={e => { e.stopPropagation(); setGate(id, action) }}
                        style={{ fontSize: 11, padding: '3px 8px', border: 'none', borderRadius: 4, cursor: 'pointer', background: COLORS[action]?.bg, color: COLORS[action]?.color }}>
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
