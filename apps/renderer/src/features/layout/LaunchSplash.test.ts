import { describe, expect, it } from 'vitest'
import { getLaunchSplashTimings } from './LaunchSplash'

describe('getLaunchSplashTimings', () => {
  it('keeps the full launch sequence brief', () => {
    const timings = getLaunchSplashTimings(false)
    expect(timings.exitAt).toBeLessThan(timings.removeAt)
    expect(timings.removeAt).toBeLessThanOrEqual(2200)
  })

  it('shortens the sequence when reduced motion is requested', () => {
    const regular = getLaunchSplashTimings(false)
    const reduced = getLaunchSplashTimings(true)
    expect(reduced.exitAt).toBeLessThan(regular.exitAt)
    expect(reduced.removeAt).toBeLessThanOrEqual(500)
  })
})
