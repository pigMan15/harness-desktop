import React, { useEffect, useState } from 'react'

export function ArtifactsPage(): React.ReactElement {
  const [files, setFiles] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    window.harness?.listArtifacts('local').then(r => {
      if (Array.isArray(r)) setFiles(r)
      else if (r?.error) setMsg(r.error)
    }).catch((e: any) => setMsg(e.message))
  }, [])

  async function viewFile(name: string) {
    setMsg('Loading...')
    try {
      const r = await window.harness!.readArtifact('local', name)
      if (r && !r.error) { setSelected(r); setMsg('') }
      else setMsg(r?.error || 'Failed')
    } catch (e: any) { setMsg(e.message) }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Artifacts</h2>
      {msg && <p style={{ color: '#c62828', background: '#ffebee', padding: 8, borderRadius: 4 }}>{msg}</p>}
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          {files.length === 0 && <p style={{ color: '#999' }}>No artifacts found.</p>}
          {files.map((f: any, i: number) => (
            <div key={i} onClick={() => viewFile(f.name)} style={{
              padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee',
              background: selected && f.name === (selected.filename || selected.name) ? '#e3f2fd' : 'transparent'
            }}>
              <div style={{ fontWeight: 500 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{f.type} · {typeof f.size === 'number' ? f.size.toLocaleString() : f.size} bytes</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 2 }}>
          {selected ? (
            <div style={{ padding: 16, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
              <h3>{selected.name || selected.filename || 'Artifact'}</h3>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                Type: {selected.type} · Size: {selected.size?.toLocaleString?.() ?? selected.size} bytes
                {selected.sha256 && <span> · SHA-256: {selected.sha256.slice(0, 16)}...</span>}
              </div>
              <pre style={{ maxHeight: 500, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {typeof selected.content === 'string' ? selected.content : JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          ) : <p style={{ color: '#999' }}>Select an artifact to preview its content.</p>}
        </div>
      </div>
    </div>
  )
}
