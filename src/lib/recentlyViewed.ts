// A tiny localStorage-backed ring buffer of recently-viewed entities, surfaced
// in the global search palette's empty state. No backend: purely local, best
// effort, and it must never throw — a corrupt or absent store just reads empty.

/** Entity kinds we bother recording. */
export type RecentlyViewedType = 'case' | 'alert' | 'observable' | 'knowledge_base'

/** A navigable target shape compatible with TanStack Router's `navigate()`. */
export type RecentlyViewedRoute = {
  to: string
  params?: Record<string, string>
  search?: Record<string, unknown>
}

export type RecentlyViewedEntry = {
  type: RecentlyViewedType
  /** Stable per-type id used for dedupe. */
  id: string
  /** Human label rendered in the row. */
  label: string
  /** Where selecting the row navigates. */
  route: RecentlyViewedRoute
}

export const RECENTLY_VIEWED_KEY = 'catlico:recently-viewed'
const CAP = 8

function isEntry(value: unknown): value is RecentlyViewedEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.type === 'string' &&
    typeof e.id === 'string' &&
    typeof e.label === 'string' &&
    typeof e.route === 'object' &&
    e.route !== null &&
    typeof (e.route as Record<string, unknown>).to === 'string'
  )
}

/** Reads the buffer, most-recent-first. Returns [] on any problem. */
export function getRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).slice(0, CAP)
  } catch {
    return []
  }
}

/**
 * Prepends `entry`, dedupes by `type+id` (keeping the newest), and caps the
 * buffer at 8. Silently no-ops if storage is unavailable or full.
 */
export function recordRecentlyViewed(entry: RecentlyViewedEntry): void {
  if (typeof window === 'undefined') return
  try {
    const existing = getRecentlyViewed().filter(
      (e) => !(e.type === entry.type && e.id === entry.id),
    )
    const next = [entry, ...existing].slice(0, CAP)
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next))
  } catch {
    // Storage disabled / quota exceeded / serialization failed — best effort.
  }
}
