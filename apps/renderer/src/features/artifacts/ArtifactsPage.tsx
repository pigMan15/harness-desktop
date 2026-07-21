import React, { useState } from 'react'

export function ArtifactsPage(): React.ReactElement {
  const [files, setFiles] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  async function loadArtifacts() {
    try {
      const result = await window.harness!.listArtifacts('local')
      if (Array.isArray(result)) setFiles(result)
    } catch { /* */ }
  }
  React.useEffect(() => { loadArtifacts() }, [])

  async function viewArtifact(name: string) {
    try {
      const result = await window.harness!.readArtifact('local', name)
      setSelected(result)
    } catch { /* */ }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Artifacts</h2>
      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <div style={{ flex: 1, maxWidth: 300 }}>
          {files.map((f: any, i: number) => (
            <div key={i} onClick={() => viewArtifact(f.name)} style={{
              padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee',
              background: selected?.name === f.name ? '#e3f2fd' : 'transparent'
            }}>
              <div style={{ fontWeight: 500 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{f.type} · {f.size} bytes</div>
            </div>
          ))}
          {files.length === 0 && <p style={{ color: '#999' }}>No artifacts found.</p>}
        </div>
        <div style={{ flex: 2 }}>
          {selected ? (
            <div style={{ padding: 16, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
              <h3>{selected.name || selected.filename}</h3>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                SHA-256: {selected.sha256?.slice(0, 16)}... · {selected.size} bytes · {selected.type}
              </div>
              <pre style={{ maxHeight: 500, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {typeof selected.content === 'string' ? selected.content : JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          ) : <p style={{ color: '#999' }}>Select an artifact to preview.</p>}
        </div>
      </div>
    </div>
  )
}
