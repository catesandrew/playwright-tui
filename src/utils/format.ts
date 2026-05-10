export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 1_000) return `${Math.round(ms)}ms`

  const totalSeconds = Math.floor(ms / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`

  const tenths = Math.floor((ms % 1_000) / 100)
  if (totalSeconds < 10) return `${totalSeconds}.${tenths}s`
  return `${totalSeconds}s`
}

export function truncate(value: string, maxLength: number): string {
  if (maxLength <= 0) return ''
  if (value.length <= maxLength) return value
  if (maxLength <= 3) return '.'.repeat(maxLength)
  return `${value.slice(0, maxLength - 3)}...`
}

export function percent(value: number): string {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  return `${Math.round(clamped * 100)}%`
}
