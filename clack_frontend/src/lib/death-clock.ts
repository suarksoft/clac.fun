export type DeathClockStatus = 'alive' | 'dying' | 'critical' | 'dead'

export interface DeathClockState {
  remainingSeconds: number
  durationSeconds: number
  percentage: number
  status: DeathClockStatus
  isDead: boolean
  compactText: string
  longText: string
  createdAtLabel: string
  diesAtLabel: string
}

function toDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value * 1000)
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatLong(seconds: number): string {
  const safe = Math.max(seconds, 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return `${hours}h ${minutes}m ${secs}s`
}

function formatCompact(seconds: number): string {
  const safe = Math.max(seconds, 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

function formatClock(value: Date): string {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function getDeathClockState(
  createdAt: Date | number,
  durationSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): DeathClockState {
  const created = toDate(createdAt)
  const createdSeconds = Math.floor(created.getTime() / 1000)
  const deathSeconds = createdSeconds + durationSeconds
  const remainingSeconds = deathSeconds - nowSeconds
  const isDead = remainingSeconds <= 0

  let status: DeathClockStatus = 'alive'
  if (isDead) status = 'dead'
  else if (remainingSeconds < 600) status = 'critical'
  else if (remainingSeconds < 3600) status = 'dying'

  const percentage = isDead ? 0 : Math.min(100, Math.max(0, (remainingSeconds / durationSeconds) * 100))
  const deathDate = new Date(deathSeconds * 1000)

  return {
    remainingSeconds: Math.max(0, remainingSeconds),
    durationSeconds,
    percentage,
    status,
    isDead,
    compactText: isDead ? "CLAC'D" : formatCompact(remainingSeconds),
    longText: isDead ? "CLAC'D" : formatLong(remainingSeconds),
    createdAtLabel: formatClock(created),
    diesAtLabel: formatClock(deathDate),
  }
}

export function getDeathClockColor(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'text-red-500'
  if (secondsLeft < 600) return 'animate-pulse text-red-500'
  if (secondsLeft < 3600) return 'text-orange-400'
  return 'text-white'
}
