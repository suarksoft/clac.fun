'use client'

import { useEffect, useMemo, useState } from 'react'
import { getDeathClockState } from '@/lib/death-clock'

function toCreatedAtSeconds(createdAt: Date | number): number {
  return createdAt instanceof Date
    ? Math.floor(createdAt.getTime() / 1000)
    : createdAt
}

export function useDeathClock(createdAt: Date | number, durationSeconds: number) {
  // Hydration-safe başlangıç: SSR ve ilk client render aynı "now" değerini kullanır.
  // Böylece Date.now() kaynaklı class/branch mismatch oluşmaz.
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
