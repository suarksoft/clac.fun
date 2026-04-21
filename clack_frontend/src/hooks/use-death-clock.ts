'use client'

import { useEffect, useMemo, useState } from 'react'
import { getDeathClockState } from '@/lib/death-clock'

function toCreatedAtSeconds(createdAt: Date | number): number {
  return createdAt instanceof Date
    ? Math.floor(createdAt.getTime() / 1000)
    : createdAt
}

export function useDeathClock(createdAt: Date | number, durationSeconds: number) {
  // Hydration-safe initialization: SSR and first client render share the same "now" value.
  // This prevents Date.now()-driven class/branch mismatches.
  const [nowSeconds, setNowSeconds] = useState(() => toCreatedAtSeconds(createdAt))

  useEffect(() => {
    setNowSeconds(Math.floor(Date.now() / 1000))

    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  return useMemo(
    () => getDeathClockState(createdAt, durationSeconds, nowSeconds),
    [createdAt, durationSeconds, nowSeconds]
  )
}
