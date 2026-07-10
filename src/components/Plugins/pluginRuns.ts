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

export const pluginRunsQueryOptions = (
  filters: PluginRunFilter = {},
  tokenFilters?: FilterClause[],
) =>
  queryOptions({
    queryKey: runKeys.list({ ...filters, tokenFilters }),
    queryFn: () => fetchPluginRuns(filters, tokenFilters),
  })

export const pluginRunDetailQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: runKeys.detail(id ?? ''),
    queryFn: () => fetchPluginRun(id as string),
    enabled: id !== null,
  })
