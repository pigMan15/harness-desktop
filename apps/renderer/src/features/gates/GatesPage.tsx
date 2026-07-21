import React, { useState } from 'react'

const GATE_NAMES: Record<string, string> = {
  G1_REQUIREMENTS: 'Requirements', G2_DESIGN: 'Design', G3_COMPILE: 'Compile',
  G4_UNIT_TEST: 'Unit Test', G5_ATDD: 'ATDD', G6_EVIDENCE: 'Evidence',
  G7_PRERELEASE: 'Prerelease', G8_ACCEPTANCE: 'Acceptance',
}
const GATE_MEANINGS: Record<string, string> = {
  G1_REQUIREMENTS: '必须有明确范围和验收标准',
  G2_DESIGN: '必须有设计、风险、回滚和实施计划',
  G3_COMPILE: '改动代码必须能编译或通过等价静态检查',
  G4_UNIT_TEST: '相关单元测试必须通过或记录豁免',
  G5_ATDD: '中高风险必须有集成、ATDD 或场景验证',
  G6_EVIDENCE: '证据文件必须记录命令、结果、产物和豁免',
  G7_PRERELEASE: '业务代码变更必须完成预发部署和接口检查',
  G8_ACCEPTANCE: '验收报告必须总结范围、变更、验证和剩余风险',
}
const SC: Record<string, { bg: string; color: string }> = {
  PASS: { bg: '#d4edda', color: '#155724' }, FAIL: { bg: '#f8d7da', color: '#721c24' },
  BLOCKED: { bg: '#f8d7da', color: '#721c24' }, NOT_RUN: { bg: '#e2e3e5', color: '#383d41' },
  NOT_REQUIRED: { bg: '#e2e3e5', color: '#6c757d' }, WAIVED: { bg: '#fff3cd', color: '#856404' },
}

export function GatesPage(): React.ReactElement {
  const [gates, setGates] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function refresh() {
    try { const r = await window.harness!.listGates('local'); if (r?.gates) setGates(r.gates) } catch { /* */ }
  }
  React.useEffect(() => { refresh() }, [])

  const passCount = Object.values(gates).filter(s => s === 'PASS').length
  const failCount = Object.values(gates).filter(s => s === 'FAIL' || s === 'BLOCKED').length

  return (
    <div style={{ padding: 24 }}>
      <h2>Quality Gates</h2>
      <div style={{ display: 'flex', gap: 16, margin: '12px 0', alignItems: 'center' }}>
        <span style={{ padding: '4px 12px', background: '#d4edda', borderRadius: 4 }}>✅ PASS: {passCount}</span>
        <span style={{ padding: '4px 12px', background: '#f8d7da', borderRadius: 4 }}>❌ FAIL: {failCount}</span>
        <button onClick={refresh} style={{ padding: '6px 14px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 6 }}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
        {Object.entries(GATE_NAMES).map(([id, name]) => {
          const status = gates[id] || 'NOT_RUN'
          const c = SC[status] || SC.NOT_RUN
          return (
            <div key={id} onClick={() => { setSelected(selected === id ? null : id); setMsg('') }}
              style={{ padding: 14, borderRadius: 8, background: c.bg, color: c.color, cursor: 'pointer', border: selected === id ? '2px solid #333' : '2px solid transparent' }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{id}</div>
              <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0' }}>{name}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{status}</div>
              {selected === id && (
                <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.9)', borderRadius: 6, color: '#333' }}>
                  <p style={{ fontSize: 12, margin: '0 0 8px 0' }}>{GATE_MEANINGS[id]}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ActionBtn id={id} action="PASS" gates={gates} setGates={setGates} setMsg={setMsg} />
                    <ActionBtn id={id} action="FAIL" gates={gates} setGates={setGates} setMsg={setMsg} />
                    <ActionBtn id={id} action="WAIVED" gates={gates} setGates={setGates} setMsg={setMsg} />
                    <ActionBtn id={id} action="BLOCKED" gates={gates} setGates={setGates} setMsg={setMsg} />
                  </div>
                  {msg && <p style={{ fontSize: 11, marginTop: 6, color: '#666' }}>{msg}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionBtn({ id, action, gates, setGates, setMsg }: {
  id: string; action: string; gates: Record<string, string>;
  setGates: (g: Record<string, string>) => void; setMsg: (m: string) => void;
}) {
  const c = SC[action] || SC.NOT_RUN
  async function apply() {
    try {
      const r = await window.harness!.evaluateGate(id, action)
      if (r?.status === action || action === 'WAIVED') {
        setGates({ ...gates, [id]: action })
        setMsg(`Gate ${id} → ${action}`)
      } else {
        setMsg(`Failed: ${r?.error || 'unknown'}`)
      }
    } catch (e: any) { setMsg(`Error: ${e.message}`) }
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); apply() }}
      style={{ fontSize: 11, padding: '3px 8px', border: 'none', borderRadius: 4, cursor: 'pointer', background: c.bg, color: c.color, fontWeight: 500 }}>
      {action}
    </button>
  )
}
