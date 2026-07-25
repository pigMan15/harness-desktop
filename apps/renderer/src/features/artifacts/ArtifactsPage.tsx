import React, { useEffect, useState } from 'react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

function inlineMarkdown(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

export function MarkdownPreview({ content }: { content: string }): React.ReactElement {
  const blocks: React.ReactNode[] = []
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      index += lines[index]?.startsWith('```') ? 1 : 0
      blocks.push(<pre key={blocks.length} className="markdown-code"><code>{code.join('\n')}</code>{language && <span className="markdown-lang">{language}</span>}</pre>)
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const children = inlineMarkdown(heading[2])
      blocks.push(level === 1 ? <h1 key={blocks.length}>{children}</h1> : level === 2 ? <h2 key={blocks.length}>{children}</h2> : level === 3 ? <h3 key={blocks.length}>{children}</h3> : <h4 key={blocks.length}>{children}</h4>)
      index += 1
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(<li key={items.length}>{inlineMarkdown(lines[index++].replace(/^\s*[-*]\s+/, ''))}</li>)
      blocks.push(<ul key={blocks.length}>{items}</ul>)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) items.push(<li key={items.length}>{inlineMarkdown(lines[index++].replace(/^\s*\d+\.\s+/, ''))}</li>)
      blocks.push(<ol key={blocks.length}>{items}</ol>)
      continue
    }
    if (line.startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].startsWith('>')) quote.push(lines[index++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={blocks.length}>{quote.map((item, quoteIndex) => <p key={quoteIndex}>{inlineMarkdown(item)}</p>)}</blockquote>)
      continue
    }
    if (line.includes('|') && lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/)) {
      const headers = line.split('|').map((cell) => cell.trim()).filter(Boolean)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(lines[index++].split('|').map((cell) => cell.trim()).filter(Boolean))
      blocks.push(<table key={blocks.length} className="markdown-table"><thead><tr>{headers.map((cell) => <th key={cell}>{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody></table>)
      continue
    }
    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !lines[index].startsWith('```') && !/^(#{1,4})\s+/.test(lines[index]) && !/^\s*[-*]\s+/.test(lines[index]) && !/^\s*\d+\.\s+/.test(lines[index]) && !lines[index].startsWith('>')) paragraph.push(lines[index++])
    blocks.push(<p key={blocks.length}>{inlineMarkdown(paragraph.join(' '))}</p>)
  }
  return <div className="markdown-preview">{blocks}</div>
}

function isMarkdownArtifact(selected: any): boolean {
  const name = String(selected?.name || selected?.filename || '').toLowerCase()
  const type = String(selected?.type || '').toLowerCase()
  return name.endsWith('.md') || type.includes('markdown')
}

function ArtifactsContent(): React.ReactElement {
  const { selectedProjectId, activeRun } = useWorkspace()
  const [files, setFiles] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!activeRun) { setFiles([]); return }
    window.harness?.listArtifacts(selectedProjectId, activeRun.run_id).then(r => {
      if (Array.isArray(r)) setFiles(r)
      else if (r?.error) setMsg(r.error)
    }).catch((e: any) => setMsg(e.message))
  }, [selectedProjectId, activeRun])

  async function viewFile(name: string) {
    setMsg('Loading...')
    try {
      if (!activeRun) throw new Error('Select a task first')
      const r = await window.harness!.readArtifact(selectedProjectId, activeRun.run_id, name)
      if (r && !r.error) { setSelected(r); setMsg('') }
      else setMsg(r?.error || 'Failed')
    } catch (e: any) { setMsg(e.message) }
  }

  return (
    <section className="page">
      <header className="page-header"><div><h1>Artifacts</h1>{activeRun && <span className="muted mono">Run {activeRun.run_id} · {activeRun.phase_dir}</span>}</div></header>
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
              {typeof selected.content === 'string' && isMarkdownArtifact(selected)
                ? <MarkdownPreview content={selected.content} />
                : <pre style={{ maxHeight: 500, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {typeof selected.content === 'string' ? selected.content : JSON.stringify(selected, null, 2)}
                </pre>}
            </div>
          ) : <p style={{ color: '#999' }}>Select an artifact to preview its content.</p>}
        </div>
      </div>
    </section>
  )
}

export function ArtifactsPage(): React.ReactElement { return <ProjectRequired><ArtifactsContent /></ProjectRequired> }
