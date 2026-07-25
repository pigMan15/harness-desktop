import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Braces, Check, Code2, Copy, Eye, File, FileText, RefreshCw, Search } from 'lucide-react'
import { ProjectRequired, useWorkspace } from '../layout/WorkspaceContext'

interface ArtifactSummary {
  name: string
  size: number
  mtime: number
  type: string
}

interface ArtifactDetail extends Partial<ArtifactSummary> {
  filename?: string
  content?: string | null
  sha256?: string
  truncated?: boolean
  error?: string
}

type ArtifactFilter = 'all' | 'markdown' | 'json' | 'text' | 'other'
type PreviewMode = 'rendered' | 'source'

const ARTIFACT_FILTERS: Array<{ id: ArtifactFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'json', label: 'JSON' },
  { id: 'text', label: 'Text' },
  { id: 'other', label: 'Other' },
]

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

export function formatArtifactSize(size: unknown): string {
  if (typeof size !== 'number' || !Number.isFinite(size)) return 'Unknown size'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isMarkdownArtifact(artifact: ArtifactDetail): boolean {
  const name = String(artifact.name || artifact.filename || '').toLowerCase()
  return name.endsWith('.md') || String(artifact.type || '').toLowerCase().includes('markdown')
}

function matchesFilter(file: ArtifactSummary, filter: ArtifactFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'other') return !['markdown', 'json', 'text'].includes(file.type)
  return file.type === filter
}

function ArtifactIcon({ type }: { type: string }): React.ReactElement {
  if (type === 'markdown') return <FileText size={17} />
  if (type === 'json') return <Braces size={17} />
  return <File size={17} />
}

function ArtifactsContent(): React.ReactElement {
  const { selectedProjectId, activeRun } = useWorkspace()
  const [files, setFiles] = useState<ArtifactSummary[]>([])
  const [selected, setSelected] = useState<ArtifactDetail | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ArtifactFilter>('all')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('rendered')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'path' | 'hash' | ''>('')

  const selectedName = selected?.name || selected?.filename || ''
  const storageKey = activeRun ? `harness.artifacts.selection.${selectedProjectId}.${activeRun.run_id}` : ''

  const viewFile = useCallback(async (name: string): Promise<void> => {
    if (!activeRun || !window.harness) return
    setLoadingFile(true); setError(''); setCopied('')
    try {
      const result = await window.harness.readArtifact(selectedProjectId, activeRun.run_id, name) as ArtifactDetail
      if (result?.error) throw new Error(result.error)
      setSelected({ ...result, name })
      if (storageKey) localStorage.setItem(storageKey, name)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load artifact')
    } finally { setLoadingFile(false) }
  }, [activeRun, selectedProjectId, storageKey])

  const loadArtifacts = useCallback(async (): Promise<void> => {
    if (!activeRun || !window.harness) { setFiles([]); setSelected(null); return }
    setLoadingList(true); setError('')
    try {
      const result = await window.harness.listArtifacts(selectedProjectId, activeRun.run_id)
      if (!Array.isArray(result)) throw new Error(result.error || 'Failed to list artifacts')
      const nextFiles = result as ArtifactSummary[]
      setFiles(nextFiles)
      if (nextFiles.length === 0) { setSelected(null); return }
      const remembered = storageKey ? localStorage.getItem(storageKey) : ''
      const preferred = nextFiles.find((file) => file.name === selectedName)?.name
        || nextFiles.find((file) => file.name === remembered)?.name
        || nextFiles[0].name
      await viewFile(preferred)
    } catch (cause) {
      setFiles([]); setSelected(null)
      setError(cause instanceof Error ? cause.message : 'Failed to load artifacts')
    } finally { setLoadingList(false) }
  }, [activeRun, selectedProjectId, selectedName, storageKey, viewFile])

  useEffect(() => {
    setQuery(''); setFilter('all'); setPreviewMode('rendered'); setSelected(null)
  }, [selectedProjectId, activeRun?.run_id])

  useEffect(() => { void loadArtifacts() }, [selectedProjectId, activeRun?.run_id])

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return files.filter((file) => matchesFilter(file, filter) && (!normalizedQuery || file.name.toLowerCase().includes(normalizedQuery)))
  }, [files, filter, query])

  async function copyValue(kind: 'path' | 'hash', value: string): Promise<void> {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => current === kind ? '' : current), 1600)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Copy failed') }
  }

  const artifactPath = selectedName && activeRun ? `${activeRun.phase_dir}/${selectedName}` : ''
  const content = typeof selected?.content === 'string' ? selected.content : selected ? JSON.stringify(selected, null, 2) : ''
  const renderMarkdown = Boolean(selected && isMarkdownArtifact(selected) && previewMode === 'rendered')

  return (
    <section className="page artifacts-page">
      <header className="page-header artifacts-header">
        <div className="artifacts-title"><h1>Artifacts</h1>{activeRun && <div className="artifacts-context"><span className="badge">{activeRun.current_node}</span><span className="muted mono truncate" title={`${activeRun.run_id} · ${activeRun.phase_dir}`}>{activeRun.run_id} · {activeRun.phase_dir}</span></div>}</div>
        <button className="button icon-button" disabled={loadingList} onClick={() => void loadArtifacts()} title="Refresh artifacts" aria-label="Refresh artifacts"><RefreshCw size={15} className={loadingList ? 'spin' : ''} /></button>
      </header>
      {error && <div className="notice error artifacts-notice">{error}</div>}
      <div className="artifacts-workbench">
        <aside className="artifact-browser" aria-label="Artifact files">
          <div className="artifact-browser-tools">
            <label className="artifact-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artifacts" aria-label="Search artifacts" /></label>
            <div className="artifact-filters" aria-label="Artifact type filter">{ARTIFACT_FILTERS.map((item) => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
          </div>
          <div className="artifact-list-summary"><span>{filteredFiles.length} of {files.length} files</span>{loadingList && <span>Refreshing...</span>}</div>
          <div className="artifact-list">
            {!loadingList && files.length === 0 && <div className="artifact-list-empty"><FileText size={24} /><strong>No artifacts yet</strong><span>Expected files will appear in</span><code title={activeRun?.phase_dir}>{activeRun?.phase_dir}</code></div>}
            {!loadingList && files.length > 0 && filteredFiles.length === 0 && <div className="artifact-list-empty"><Search size={22} /><strong>No matching files</strong><span>Adjust the search or type filter.</span></div>}
            {filteredFiles.map((file) => <button key={file.name} className={`artifact-row ${file.name === selectedName ? 'selected' : ''}`} onClick={() => void viewFile(file.name)}>
              <span className={`artifact-file-icon ${file.type}`}><ArtifactIcon type={file.type} /></span>
              <span className="artifact-file-copy"><strong title={file.name}>{file.name}</strong><small>{file.type.toUpperCase()} · {formatArtifactSize(file.size)}</small></span>
            </button>)}
          </div>
        </aside>
        <main className="artifact-reader">
          {selected ? <>
            <div className="artifact-reader-toolbar">
              <div className="artifact-reader-title"><strong title={selectedName}>{selectedName}</strong><span>{String(selected.type || 'file').toUpperCase()} · {formatArtifactSize(selected.size)}{selected.truncated ? ' · Preview truncated' : ''}</span></div>
              <div className="artifact-reader-actions">
                {isMarkdownArtifact(selected) && <div className="segmented artifact-view-toggle" aria-label="Preview mode"><button className={previewMode === 'rendered' ? 'active' : ''} onClick={() => setPreviewMode('rendered')} title="Rendered preview"><Eye size={14} />Rendered</button><button className={previewMode === 'source' ? 'active' : ''} onClick={() => setPreviewMode('source')} title="Source preview"><Code2 size={14} />Source</button></div>}
                <button className="button icon-button" onClick={() => void copyValue('path', artifactPath)} title={copied === 'path' ? 'Path copied' : 'Copy artifact path'} aria-label="Copy artifact path">{copied === 'path' ? <Check size={15} /> : <Copy size={15} />}</button>
                <button className="button icon-button" disabled={!selected.sha256} onClick={() => void copyValue('hash', selected.sha256 || '')} title={copied === 'hash' ? 'SHA-256 copied' : 'Copy SHA-256'} aria-label="Copy SHA-256">{copied === 'hash' ? <Check size={15} /> : <span className="hash-icon">#</span>}</button>
              </div>
            </div>
            <div className={`artifact-document ${loadingFile ? 'loading' : ''}`}>
              {loadingFile ? <div className="artifact-loading"><span className="spinner" />Loading preview...</div> : renderMarkdown ? <MarkdownPreview content={content} /> : <pre className="artifact-source">{content}</pre>}
            </div>
            {selected.sha256 && <footer className="artifact-reader-footer"><span>SHA-256</span><code title={selected.sha256}>{selected.sha256}</code></footer>}
          </> : <div className="empty-state artifact-reader-empty"><FileText size={32} /><h2>{loadingList ? 'Loading artifacts' : 'Select an artifact'}</h2><p>{loadingList ? 'Reading the current Run phase directory.' : 'Choose a file from the browser to review its content.'}</p></div>}
        </main>
      </div>
    </section>
  )
}

export function ArtifactsPage(): React.ReactElement { return <ProjectRequired><ArtifactsContent /></ProjectRequired> }
