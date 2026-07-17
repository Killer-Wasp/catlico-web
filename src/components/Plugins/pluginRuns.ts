import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type { PluginRun, PluginRunPublic, PluginRunStatus } from './plugins.types'

// ── Query key factory ───────────────────────────────────────────────────────

export const runKeys = {
  all: ['plugin-runs'] as const,
  lists: () => [...runKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...runKeys.lists(), filters] as const,
  details: () => [...runKeys.all, 'detail'] as const,
  detail: (id: string) => [...runKeys.details(), id] as const,
}

// ── DTO mapping ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, PluginRunStatus> = {
  queued: 'queued',
  accepted: 'accepted',
  running: 'running',
  success: 'success',
  failure: 'failure',
  timeout: 'timeout',
  cancelled: 'cancelled',
  cancelling: 'cancelling',
  skipped: 'skipped',
}

function toStatus(value: string): PluginRunStatus {
  return STATUS_MAP[value] ?? 'failure'
}

// Non-terminal statuses: a run in one of these is still expected to change. The
// list and detail queries poll while any run is active so status transitions
// (queued → running → success) surface without a manual refresh, then stop once
// everything has settled — an idle runs page (and the navbar count) mustn't poll
// forever.
const ACTIVE_STATUSES: ReadonlySet<PluginRunStatus> = new Set([
  'queued',
  'accepted',
  'running',
  'cancelling',
])

const isActiveStatus = (status: PluginRunStatus) => ACTIVE_STATUSES.has(status)

function toPluginRun(dto: PluginRunPublic): PluginRun {
  return {
    id: dto.id,
    eventId: dto.event_id,
    eventType: dto.event_type,
    organisationId: dto.organisation_id,
    pluginId: dto.plugin_id,
    pluginVersionId: dto.plugin_version_id,
    runnerId: dto.runner_id,
    eventObjectType: dto.event_object_type,
    eventObjectId: dto.event_object_id,
    status: toStatus(dto.status),
    skipReason: dto.skip_reason as PluginRun['skipReason'],
    startedAt: dto.started_at,
    endedAt: dto.ended_at,
    error: dto.error,
    resultSummary: dto.result_summary,
    operationCount: dto.operation_count,
    createdAt: dto.created_at,
  }
}

// ── Types ───────────────────────────────────────────────────────────────────

export type PluginRunFilter = {
  skip?: number
  limit?: number
  status?: string
  plugin_id?: string
  runner_id?: string
}

// The backend returns a bare list (most-recent-first, capped server-side), not
// a paged envelope. Accept either shape so we survive a future pagination change.
type RunsResponse = PluginRunPublic[] | { items: PluginRunPublic[]; total: number }

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchPluginRuns(
  filters?: PluginRunFilter,
  tokenFilters?: FilterClause[],
): Promise<{ runs: PluginRun[]; total: number }> {
  const params = new URLSearchParams()
  if (filters?.skip) params.set('skip', String(filters.skip))
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.plugin_id) params.set('plugin_id', filters.plugin_id)
  if (filters?.runner_id) params.set('runner_id', filters.runner_id)
  appendClauses(params, tokenFilters)

  const body = await api
    .get(`plugin-runs?${params.toString()}`)
    .json<RunsResponse>()

  const items = Array.isArray(body) ? body : body.items
  const total = Array.isArray(body) ? body.length : body.total
  return {
    runs: items.map(toPluginRun),
    total,
  }
}

export async function fetchPluginRun(id: string): Promise<PluginRun> {
  const dto = await api.get(`plugin-runs/${id}`).json<PluginRunPublic>()
  return toPluginRun(dto)
}

export async function cancelPluginRun(id: string): Promise<void> {
  await api.post(`plugin-runs/${id}/cancel`)
}

export async function retryFailedRuns(): Promise<number> {
  const result = await api
    .post('plugin-runs/retry-failed')
    .json<{ retried: number }>()
  return result.retried
}

export async function clearFinishedRuns(): Promise<number> {
  const result = await api
    .post('plugin-runs/clear-finished')
    .json<{ cleared: number }>()
  return result.cleared
}

// ── queryOptions units ──────────────────────────────────────────────────────

// `pollUntil` (epoch ms) keeps the list polling even when it holds no active run,
// until that moment passes. The runs page opens this window on mount so a run that
// is dispatched but not yet persisted (the create→outbox→runner pipeline lands the
// row a beat later) gets discovered on its own — without it, an idle list never
// refetches and the row only appears on a manual refresh. Callers that omit it (the
// navbar badge) keep the active-only gate and still stop polling when idle.
type PluginRunsQueryExtras = { pollUntil?: number }

export const pluginRunsQueryOptions = (
  filters: PluginRunFilter = {},
  tokenFilters?: FilterClause[],
  extras?: PluginRunsQueryExtras,
) =>
  queryOptions({
    queryKey: runKeys.list({ ...filters, tokenFilters }),
    queryFn: () => fetchPluginRuns(filters, tokenFilters),
    // Runs are time-sensitive: opt out of the global 30s staleTime so navigating
    // to the page always refetches and a just-triggered run shows immediately
    // (rather than sitting behind stale cache for up to 30s).
    staleTime: 0,
    // Poll while any run is still in flight, so a just-queued run and its
    // progress show up on their own; stop once every run is terminal — except
    // during the caller's discovery window, which keeps polling so a not-yet-
    // persisted run can appear. Self-terminates once the window passes.
    refetchInterval: (query) => {
      if (query.state.data?.runs.some((r) => isActiveStatus(r.status))) return 3_000
      if (extras?.pollUntil !== undefined && Date.now() < extras.pollUntil) return 3_000
      return false
    },
  })

export const pluginRunDetailQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: runKeys.detail(id ?? ''),
    queryFn: () => fetchPluginRun(id as string),
    enabled: id !== null,
    staleTime: 0,
    // Keep an open run's drawer live until it reaches a terminal status.
    refetchInterval: (query) =>
      query.state.data && isActiveStatus(query.state.data.status) ? 2_000 : false,
  })
