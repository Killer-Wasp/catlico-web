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
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type { Severity, Tlp } from '#/lib/domain'
import type { Alert } from './alerts.types'
import { isHTTPError } from 'ky'

/** Column the alert list is sorted by, server-side. */
export type AlertSort = 'id' | 'age'

export type AlertListFilters = {
  clauses?: FilterClause[]
  sort?: AlertSort
  order?: 'asc' | 'desc'
  skip?: number
  limit?: number
}

export type AlertsResult = { alerts: Alert[]; total: number }

/** Filterable values across the org's alerts, for the filter dropdowns. */
export type AlertFacets = {
  sources: string[]
  tagKeys: Record<string, string[]>
}

export const DEFAULT_ALERT_FILTERS: AlertListFilters = {
  sort: 'id',
  order: 'desc',
  skip: 0,
  limit: 10,
}

/**
 * Hierarchical query-key factory. Always derive keys here — never hand-write
 * an array at a call site. The hierarchy lets you invalidate broadly
 * (`alertKeys.all` → every alert query) or narrowly (`alertKeys.detail(id)`).
 */
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters: AlertListFilters = DEFAULT_ALERT_FILTERS) =>
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

type CasePublic = {
  id: number
}

export class AlertAlreadyPromotedError extends Error {
  constructor(public readonly caseId: number) {
    super(`Alert already promoted to case ${caseId}`)
    this.name = 'AlertAlreadyPromotedError'
  }
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

async function fetchAlerts(filters: AlertListFilters): Promise<AlertsResult> {
  const params = new URLSearchParams()
  appendClauses(params, filters.clauses)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const page = await api
    .get('alerts/', { searchParams: params })
    .json<Page<AlertPublic>>()
  return { alerts: page.items.map(toAlert), total: page.total }
}

async function fetchAlertFacets(): Promise<AlertFacets> {
  const raw = await api
    .get('alerts/filters')
    .json<{ sources: string[]; tag_keys: Record<string, string[]> }>()
  return { sources: raw.sources, tagKeys: raw.tag_keys }
}

async function fetchAlert(id: string): Promise<Alert> {
  const numeric = id.replace(/^AL-/, '')
  const alert = await api.get(`alerts/${numeric}`).json<AlertPublic>()
  return toAlert(alert)
}

export async function promoteAlertToCase({
  alertId,
  caseTemplateId,
}: {
  alertId: string
  caseTemplateId?: number | null
}): Promise<number> {
  const numeric = alertId.replace(/^AL-/, '')
  try {
    const created = await api
      .post(`alerts/${numeric}/promote`, {
        json: { case_template_id: caseTemplateId ?? null },
      })
      .json<CasePublic>()
    return created.id
  } catch (error) {
    if (isHTTPError(error)) {
      try {
        const body: { detail?: string } = await error.response.json()
        const match = body.detail?.match(/already promoted to case (\d+)/i)
        if (match) throw new AlertAlreadyPromotedError(Number(match[1]))
      } catch (parseError) {
        if (parseError instanceof AlertAlreadyPromotedError) throw parseError
      }
    }
    throw error
  }
}

export async function dismissAlert(alertId: string): Promise<void> {
  const numeric = alertId.replace(/^AL-/, '')
  await api.patch(`alerts/${numeric}`, { json: { status: 'Ignored' } })
}

export async function mergeAlertsToCase({
  alertIds,
  caseTemplateId,
  targetCaseId,
}: {
  alertIds: string[]
  caseTemplateId?: number | null
  targetCaseId?: number | null
}): Promise<number> {
  const json: {
    alert_ids: number[]
    case_template_id?: number | null
    target_case_id?: number
  } = {
    alert_ids: alertIds.map((id) => Number(id.replace(/^AL-/, ''))),
  }

  if (targetCaseId != null) {
    json.target_case_id = targetCaseId
  } else {
    json.case_template_id = caseTemplateId ?? null
  }

  const created = await api
    .post('alerts/merge', {
      json,
    })
    .json<CasePublic>()
  return created.id
}

// --- query options ---------------------------------------------------------
// `queryOptions(...)` is the shareable unit. It binds a key to a fetcher and is
// what loaders and components both consume.

export const alertsQueryOptions = (
  filters: AlertListFilters = DEFAULT_ALERT_FILTERS,
) =>
  queryOptions({
    queryKey: alertKeys.list(filters),
    queryFn: () => fetchAlerts(filters),
    placeholderData: keepPreviousData,
  })

export const alertFacetsQueryOptions = () =>
  queryOptions({
    queryKey: [...alertKeys.all, 'facets'] as const,
    queryFn: fetchAlertFacets,
  })

export const alertQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.detail(id),
    queryFn: () => fetchAlert(id),
  })
