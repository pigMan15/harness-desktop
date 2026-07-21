/**
 * Root React component for Harness Desktop.
 *
 * M1 scope: displays Runtime connection status (healthy / unavailable / connecting).
 * Phase 2+: full application shell with projects, runs, workflow studio, etc.
 *
 * Architecture §8.2: Renderer only has UI state; all business data comes from
 * the typed Preload API (window.harness).
 */

import React, { useCallback, useEffect, useState } from 'react'

/** Type declaration for the Preload API exposed via contextBridge. */
declare global {
  interface Window {
    harness?: {
      health: () => Promise<{ healthy: boolean; runtimeVersion?: string; protocolVersion?: string }>
      onRuntimeEvent: (channel: string, callback: (...args: unknown[]) => void) => void
    }
  }
}

type RuntimeStatus = 'connecting' | 'healthy' | 'unavailable'

export function App(): React.ReactElement {
  const [status, setStatus] = useState<RuntimeStatus>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [versionInfo, setVersionInfo] = useState<{ runtime?: string; protocol?: string }>({})

  const checkHealth = useCallback(async () => {
    if (!window.harness) {
      setStatus('unavailable')
      setErrorMessage('Preload API not available — running outside Electron?')
      return
    }
    try {
      const result = await window.harness.health()
      // Runtime returns: { status, runtime_version, protocol_version, pid }
      if (result.status === 'healthy') {
        setStatus('healthy')
        setVersionInfo({
          runtime: result.runtime_version,
          protocol: result.protocol_version,
        })
        setErrorMessage(null)
      } else {
        setStatus('unavailable')
      }
    } catch {
      setStatus('unavailable')
      setErrorMessage('Failed to reach Runtime')
    }
  }, [])

  useEffect(() => {
    if (!window.harness) return

    // Listen for Runtime status changes
    window.harness.onRuntimeEvent('runtime:status', (data: unknown) => {
      const d = data as { healthy?: boolean }
      setStatus(d?.healthy ? 'healthy' : 'unavailable')
    })

    window.harness.onRuntimeEvent('runtime:error', (data: unknown) => {
      const d = data as { message?: string }
      setStatus('unavailable')
      setErrorMessage(d?.message ?? 'Unknown runtime error')
    })

    // Initial health check
    checkHealth()
  }, [checkHealth])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>Harness Desktop</h1>
      <div style={{ marginTop: 16 }}>
        <StatusBadge status={status} />
      </div>
      {errorMessage && (
        <div style={{ marginTop: 12, padding: 8, background: '#fff3f3', borderRadius: 4 }}>
          {errorMessage}
        </div>
      )}
      {status === 'healthy' && (
        <div style={{ marginTop: 12 }}>
          <p>Runtime version: {versionInfo.runtime ?? 'unknown'}</p>
          <p>Protocol version: {versionInfo.protocol ?? 'unknown'}</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: RuntimeStatus }): React.ReactElement {
  const config: Record<RuntimeStatus, { label: string; color: string; bg: string }> = {
    connecting: { label: 'Connecting…', color: '#856404', bg: '#fff3cd' },
    healthy: { label: 'Runtime healthy ✓', color: '#155724', bg: '#d4edda' },
    unavailable: { label: 'Runtime unavailable ✗', color: '#721c24', bg: '#f8d7da' },
  }
  const c = config[status]
  return (
    <span style={{ padding: '4px 12px', borderRadius: 4, color: c.color, background: c.bg, fontWeight: 500 }}>
      {c.label}
    </span>
  )
}
