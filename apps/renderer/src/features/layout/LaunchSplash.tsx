import React, { useEffect, useState } from 'react'
import { Hexagon, Workflow } from 'lucide-react'

export interface LaunchSplashTimings {
  exitAt: number
  removeAt: number
}

export function getLaunchSplashTimings(reducedMotion: boolean): LaunchSplashTimings {
  return reducedMotion ? { exitAt: 220, removeAt: 480 } : { exitAt: 1450, removeAt: 2050 }
}

export function LaunchSplash(): React.ReactElement | null {
  const [leaving, setLeaving] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timings = getLaunchSplashTimings(reducedMotion)
    const exitTimer = window.setTimeout(() => setLeaving(true), timings.exitAt)
    const removeTimer = window.setTimeout(() => setVisible(false), timings.removeAt)
    return () => { window.clearTimeout(exitTimer); window.clearTimeout(removeTimer) }
  }, [])

  if (!visible) return null

  return (
    <div className={`launch-splash${leaving ? ' leaving' : ''}`} role="status" aria-label="Harness Desktop is starting">
      <div className="launch-texture" aria-hidden="true" />
      <div className="launch-rays" aria-hidden="true" />
      <div className="launch-sigil" aria-hidden="true">
        <span className="launch-ring ring-outer" />
        <span className="launch-ring ring-middle" />
        <span className="launch-ring ring-inner" />
        <span className="launch-rune rune-one"><span>I</span></span>
        <span className="launch-rune rune-two"><span>IV</span></span>
        <span className="launch-rune rune-three"><span>VIII</span></span>
        <Hexagon className="launch-hexagon" strokeWidth={0.8} />
        <Workflow className="launch-workflow" strokeWidth={1.2} />
      </div>
      <div className="launch-copy">
        <span className="launch-kicker">THE GOVERNED AGENT</span>
        <h1>HARNESS</h1>
        <p>DESKTOP <span>/</span> PROTOCOL 01</p>
        <div className="launch-progress" aria-hidden="true"><span /></div>
      </div>
      <div className="launch-coordinate coordinate-left" aria-hidden="true">INTENT / RISK / ROUTE</div>
      <div className="launch-coordinate coordinate-right" aria-hidden="true">EST. MMXXVI</div>
    </div>
  )
}
