import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface RuntimeCtx { ready: boolean; status: string; version: { runtime?: string; protocol?: string } }

const Ctx = createContext<RuntimeCtx>({ ready: false, status: 'connecting', version: {} })

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RuntimeCtx>({ ready: false, status: 'connecting', version: {} })

  const check = useCallback(async () => {
    if (!window.harness) { setState({ ready: false, status: 'unavailable', version: {} }); return }
    for (let i = 0; i < 15; i++) {
      try {
        const r = await window.harness.health()
        if (r?.status === 'healthy') {
          setState({ ready: true, status: 'healthy', version: { runtime: r.runtime_version, protocol: r.protocol_version } })
          return
        }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 2000))
    }
    setState({ ready: false, status: 'timeout', version: {} })
  }, [])

  useEffect(() => { check() }, [check])

  useEffect(() => {
    if (!window.harness) return
    window.harness.onRuntimeEvent('runtime:status', (d: any) => {
      if (d?.healthy) setState(s => ({ ...s, ready: true, status: 'healthy' }))
      else setState(s => ({ ...s, ready: false, status: 'unavailable' }))
    })
    window.harness.onRuntimeEvent('runtime:error', () => {
      setState(s => ({ ...s, ready: false, status: 'unavailable' }))
    })
  }, [])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export function useRuntime(): RuntimeCtx { return useContext(Ctx) }
