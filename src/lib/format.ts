/** Small, dependency-free formatting helpers shared by the dashboard pages. */

export function formatRelative(date: Date | null | undefined, now = new Date()): string {
  if (!date) return '—'
  const diff = now.getTime() - date.getTime()
  const abs = Math.abs(diff)
  const minutes = Math.round(abs / 60_000)
  const suffix = diff >= 0 ? ' ago' : ' from now'
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${suffix}`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h${suffix}`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}${suffix}`
  if (days < 30) return `${Math.round(days / 7)} wk${suffix}`
  return date.toISOString().slice(0, 10)
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toISOString().slice(0, 10)
}

/** "https://www.example.com/path" -> "example.com" for compact display. */
export function displayHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}
