/**
 * Data-fetching layer for Alerts — the reference implementation of the
 * project's TanStack Query pattern. Copy this file's shape for new features:
 *
 *   1. a query-key factory  (`alertKeys`)
 *   2. fetchers + DTO mapping (`fetchAlerts`, `toAlert`)
 *   3. `queryOptions` units (`alertsQueryOptions`, `alertQueryOptions`)
 *
 * Routes prefetch with `context.queryClient.ensureQueryData(...)` and
 * components read with `useSuspenseQuery(...)` — both pass the *same*
 * `queryOptions`, so the loader-warmed cache and the component read share a
 * key and never double-fetch.
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { Severity, Tlp } from '#/lib/domain'
import type { Alert } from './alerts.types'

export type AlertListFilters = {
  /** Backend `status_filter` (New | InProgress | Imported | Ignored). */
  status?: string
  /** Backend `source_filter` (detection source, e.g. "CrowdStrike"). */
  source?: string
}

/**
 * Hierarchical query-key factory. Always derive keys here — never hand-write
 * an array at a call site. The hierarchy lets you invalidate broadly
 * (`alertKeys.all` → every alert query) or narrowly (`alertKeys.detail(id)`).
 */
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters: AlertListFilters = {}) =>
    [...alertKeys.lists(), filters] as const,
  details: () => [...alertKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
}

// --- API DTOs --------------------------------------------------------------
// Mirrors the backend `Page[AlertPublic]` shape (app/models/alert.py).

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

type AlertPublic = {
  id: number
  type: string
  source: string
  source_ref: string
  external_link: string | null
  title: string
  description: string
  severity: number
  tlp: number
  pap: number
  date: string
  status: string
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

/**
 * Map a backend `AlertPublic` to the UI `Alert`. Some list-view fields aren't
 * carried by the list endpoint (tags, observables, similar cases live behind
 * `/alerts/{id}/...`), so they default to empty here.
 */
function toAlert(a: AlertPublic): Alert {
  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(a.date).getTime()) / 60_000),
  )
  return {
    id: `AL-${a.id}`,
    sev: clamp(a.severity, 1, 4) as Severity,
    tlp: clamp(a.tlp, 0, 3) as Tlp,
    title: a.title,
    src: a.source,
    tags: [],
    ageMin,
    breach: false,
    description: a.description,
    observables: [],
    similarCases: [],
  }
}

// --- fetchers --------------------------------------------------------------

async function fetchAlerts(filters: AlertListFilters): Promise<Alert[]> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status_filter', filters.status)
  if (filters.source) params.set('source_filter', filters.source)
  const page = await api
    .get('alerts/', { searchParams: params })
    .json<Page<AlertPublic>>()
  return page.items.map(toAlert)
}

async function fetchAlert(id: string): Promise<Alert> {
  const numeric = id.replace(/^AL-/, '')
  const alert = await api.get(`alerts/${numeric}`).json<AlertPublic>()
  return toAlert(alert)
}

// --- query options ---------------------------------------------------------
// `queryOptions(...)` is the shareable unit. It binds a key to a fetcher and is
// what loaders and components both consume.

export const alertsQueryOptions = (filters: AlertListFilters = {}) =>
  queryOptions({
    queryKey: alertKeys.list(filters),
    queryFn: () => fetchAlerts(filters),
  })

export const alertQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.detail(id),
    queryFn: () => fetchAlert(id),
  })
