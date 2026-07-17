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
import type { QueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type { CaseStatusRef, Severity, Tlp } from '#/lib/domain'
import type {
  PluginRunPublic,
  QueuePluginRunRequest,
} from '#/components/Plugins/plugins.types'
import type { Alert, AlertSimilarCase } from './alerts.types'
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
  comments: (id: string) => [...alertKeys.detail(id), 'comments'] as const,
  tags: (id: string) => [...alertKeys.detail(id), 'tags'] as const,
  observables: (id: string) =>
    [...alertKeys.detail(id), 'observables'] as const,
  similarCases: (id: string) =>
    [...alertKeys.detail(id), 'similar-cases'] as const,
  linkedCases: (id: string) =>
    [...alertKeys.detail(id), 'linked-cases'] as const,
  customFieldValues: (id: string) =>
    [...alertKeys.detail(id), 'custom-field-values'] as const,
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

/** Mirrors the backend CommentPublic (app/models/comment.py). */
type CommentPublic = {
  id: string
  message: string
  created_at: string
  author_name: string
}

/** A persisted alert comment, mapped for display. */
export type AlertComment = {
  id: string
  author: string
  time: string
  body: string
}

/** Mirrors the backend ObservablePublic (app/models/observable.py). */
type ObservablePublic = {
  id: string
  observable_type: string
  data: string
  tlp: number
  ioc: boolean
  sighted: boolean
}

/** An alert observable, mapped for the drawer's observables table. */
export type AlertObservableRow = {
  id: string
  type: string
  value: string
  tlp: Tlp
  ioc: boolean
  sighted: boolean
}

/** Mirrors the backend SimilarCasePublic (app/models/case_.py). */
type SimilarCasePublic = {
  id: number
  title: string
  severity: number
  status: CaseStatusRef | null
  shared_observables: number
}

/** Mirrors the backend LinkedCasePublic (app/models/case_.py). */
type LinkedCasePublic = {
  id: number
  title: string
  severity: number
  status: CaseStatusRef | null
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
    firstSeenAt: a.date,
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

async function fetchAlertComments(id: string): Promise<AlertComment[]> {
  const numeric = id.replace(/^AL-/, '')
  const page = await api
    .get(`alerts/${numeric}/comments`, { searchParams: { sort_order: 'asc' } })
    .json<Page<CommentPublic>>()
  return page.items.map((c) => ({
    id: c.id,
    author: c.author_name,
    time: new Date(c.created_at).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    body: c.message,
  }))
}

async function fetchAlertTags(id: string): Promise<string[]> {
  const numeric = id.replace(/^AL-/, '')
  return api.get(`alerts/${numeric}/tags`).json<string[]>()
}

export async function setAlertTags({
  alertId,
  tags,
}: {
  alertId: string
  tags: string[]
}): Promise<string[]> {
  const numeric = alertId.replace(/^AL-/, '')
  return api.put(`alerts/${numeric}/tags`, { json: { tags } }).json<string[]>()
}

export async function createAlertComment({
  alertId,
  message,
}: {
  alertId: string
  message: string
}): Promise<void> {
  const numeric = alertId.replace(/^AL-/, '')
  await api.post(`alerts/${numeric}/comments`, { json: { message } })
}

export async function fetchAlertObservables(
  id: string,
): Promise<AlertObservableRow[]> {
  const numeric = id.replace(/^AL-/, '')
  const page = await api
    .get(`alerts/${numeric}/observables`)
    .json<Page<ObservablePublic>>()
  return page.items.map((o) => ({
    id: o.id,
    type: o.observable_type,
    value: o.data,
    tlp: clamp(o.tlp, 0, 3) as Tlp,
    ioc: o.ioc,
    sighted: o.sighted,
  }))
}

async function fetchAlertSimilarCases(id: string): Promise<AlertSimilarCase[]> {
  const numeric = id.replace(/^AL-/, '')
  const items = await api
    .get(`alerts/${numeric}/similar-cases`)
    .json<SimilarCasePublic[]>()
  return items.map((c) => ({
    id: `#${c.id}`,
    title: c.title,
    sev: clamp(c.severity, 1, 4) as Severity,
    status: c.status,
  }))
}

async function fetchAlertLinkedCases(id: string): Promise<AlertSimilarCase[]> {
  const numeric = id.replace(/^AL-/, '')
  const items = await api
    .get(`alerts/${numeric}/linked-cases`)
    .json<LinkedCasePublic[]>()
  return items.map((c) => ({
    id: `#${c.id}`,
    title: c.title,
    sev: clamp(c.severity, 1, 4) as Severity,
    status: c.status,
  }))
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

// Reverse of promote/merge: unlink the alert from its case, returning it to New.
export async function detachAlertFromCase(alertId: string): Promise<void> {
  const numeric = alertId.replace(/^AL-/, '')
  await api.post(`alerts/${numeric}/detach`)
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

export const alertCommentsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.comments(id),
    queryFn: () => fetchAlertComments(id),
  })

export const alertTagsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.tags(id),
    queryFn: () => fetchAlertTags(id),
  })

export const alertObservablesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.observables(id),
    queryFn: () => fetchAlertObservables(id),
  })

export const alertSimilarCasesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.similarCases(id),
    queryFn: () => fetchAlertSimilarCases(id),
  })

export const alertLinkedCasesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.linkedCases(id),
    queryFn: () => fetchAlertLinkedCases(id),
  })

// --- Alert observables (create) --------------------------------------------
// Mirror the case create fns (casesQueries) against the alert routes, so the
// shared CreateObservableDialog can target an alert via its `alertId` prop.

export async function createAlertObservable(
  alertId: string,
  body: {
    observable_type: string
    data: string
    message?: string
    tlp?: number
    ioc?: boolean
    sighted?: boolean
  },
): Promise<ObservablePublic> {
  const numeric = alertId.replace(/^AL-/, '')
  return api
    .post(`alerts/${numeric}/observables`, { json: body })
    .json<ObservablePublic>()
}

export async function createAlertObservableFile(
  alertId: string,
  body: {
    observable_type: string
    file: File
    message?: string
    tlp?: number
    ioc?: boolean
    sighted?: boolean
  },
): Promise<ObservablePublic> {
  const numeric = alertId.replace(/^AL-/, '')
  const form = new FormData()
  form.append('file', body.file)
  form.append('observable_type', body.observable_type)
  if (body.message != null) form.append('message', body.message)
  if (body.tlp != null) form.append('tlp', String(body.tlp))
  if (body.ioc != null) form.append('ioc', String(body.ioc))
  if (body.sighted != null) form.append('sighted', String(body.sighted))
  return api
    .post(`alerts/${numeric}/observables/file`, { body: form })
    .json<ObservablePublic>()
}

// --- Alert custom fields ----------------------------------------------------

async function fetchAlertCustomFieldValues(
  id: string,
): Promise<Record<string, unknown>> {
  const numeric = id.replace(/^AL-/, '')
  return api
    .get(`alerts/${numeric}/custom-fields`)
    .json<Record<string, unknown>>()
}

/**
 * Replace-semantics PUT of an alert's custom-field values (mirror of
 * `setCaseCustomFields`). The full desired set is sent; the backend 422s on a
 * missing mandatory field — its `detail` is surfaced as the thrown message.
 */
export async function setAlertCustomFields(
  id: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const numeric = id.replace(/^AL-/, '')
  try {
    return await api
      .put(`alerts/${numeric}/custom-fields`, { json: { values } })
      .json<Record<string, unknown>>()
  } catch (error) {
    if (isHTTPError(error)) {
      try {
        const body: { detail?: string } = await error.response.json()
        if (body.detail) throw new Error(body.detail)
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message) throw parseError
      }
    }
    throw error
  }
}

export const alertCustomFieldValuesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: alertKeys.customFieldValues(id),
    queryFn: () => fetchAlertCustomFieldValues(id),
  })

/** Custom-field values changed for an alert: refresh the raw values + the alert
 *  list (whose rows carry a custom-field summary). */
export function invalidateAlertCustomFieldQueries(
  qc: QueryClient,
  alertId: string,
) {
  qc.invalidateQueries({ queryKey: alertKeys.customFieldValues(alertId) })
  qc.invalidateQueries({ queryKey: alertKeys.lists() })
}

// --- Alert plugin runs (Run analyzers on the alert entity) ------------------

export async function queueAlertPluginRun(
  alertId: string,
  body: QueuePluginRunRequest,
): Promise<PluginRunPublic> {
  const numeric = alertId.replace(/^AL-/, '')
  return api
    .post(`alerts/${numeric}/plugin-runs`, { json: body })
    .json<PluginRunPublic>()
}
