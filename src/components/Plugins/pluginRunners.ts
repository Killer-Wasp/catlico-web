import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type {
  PluginRunner,
  PluginRunnerPublic,
  PluginRunnerStatus,
  CreateRunnerResponse,
  CreateRunnerRequest,
  RunnerStats,
  StatsWindow,
} from './plugins.types'

// ── Query key factory ───────────────────────────────────────────────────────

export const runnerKeys = {
  all: ['plugin-runners'] as const,
  lists: () => [...runnerKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...runnerKeys.lists(), filters] as const,
  details: () => [...runnerKeys.all, 'detail'] as const,
  detail: (id: string) => [...runnerKeys.details(), id] as const,
  stats: (id: string, window: StatsWindow) =>
    [...runnerKeys.detail(id), 'stats', window] as const,
}

// ── DTO mapping ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, PluginRunnerStatus> = {
  healthy: 'healthy',
  unhealthy: 'unhealthy',
  offline: 'offline',
}

function toStatus(value: string): PluginRunnerStatus {
  return STATUS_MAP[value] ?? 'offline'
}

function toPluginRunner(dto: PluginRunnerPublic): PluginRunner {
  return {
    id: dto.id,
    name: dto.name,
    baseUrl: dto.base_url,
    status: toStatus(dto.status),
    version: dto.version,
    isolationMode: dto.isolation_mode,
    lastHealthAt: dto.last_health_at,
    lastHeartbeatAt: dto.last_heartbeat_at,
    createdAt: dto.created_at,
  }
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchPluginRunners(): Promise<PluginRunner[]> {
  const dtos = await api.get('plugin-runners').json<PluginRunnerPublic[]>()
  return dtos.map(toPluginRunner)
}

export async function fetchPluginRunner(id: string): Promise<PluginRunner> {
  const dto = await api
    .get(`plugin-runners/${id}`)
    .json<PluginRunnerPublic>()
  return toPluginRunner(dto)
}

export async function fetchRunnerStats(
  id: string,
  window: StatsWindow = '7d',
): Promise<RunnerStats> {
  return api
    .get(`plugin-runners/${id}/stats?window=${window}`)
    .json<RunnerStats>()
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function createPluginRunner(
  request: CreateRunnerRequest,
): Promise<CreateRunnerResponse> {
  return api
    .post('plugin-runners', { json: request })
    .json<CreateRunnerResponse>()
}

export async function triggerHealthCheck(id: string): Promise<void> {
  await api.post(`plugin-runners/${id}/health-check`)
}

export async function triggerSync(id: string): Promise<void> {
  await api.post(`plugin-runners/${id}/sync`)
}

export async function reEnrollRunner(id: string): Promise<CreateRunnerResponse> {
  return api
    .post(`plugin-runners/${id}/re-enroll`)
    .json<CreateRunnerResponse>()
}

// ── queryOptions units ──────────────────────────────────────────────────────

export const pluginRunnersQueryOptions = () =>
  queryOptions({
    queryKey: runnerKeys.list(),
    queryFn: fetchPluginRunners,
    refetchInterval: 30_000, // poll for health changes
  })

export const pluginRunnerDetailQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: runnerKeys.detail(id ?? ''),
    queryFn: () => fetchPluginRunner(id as string),
    enabled: id !== null,
  })

export const runnerStatsQueryOptions = (id: string, window: StatsWindow = '7d') =>
  queryOptions({
    queryKey: runnerKeys.stats(id, window),
    queryFn: () => fetchRunnerStats(id, window),
  })
