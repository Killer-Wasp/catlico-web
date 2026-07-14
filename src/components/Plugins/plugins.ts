import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type {
  Plugin,
  PluginManifest,
  PluginPublic,
  PluginConfigParam,
  ParamConfigStatus,
  ConfigPayload,
  ConfigResponse,
  ConfigTestResponse,
  RunPluginRequest,
  RunnablePlugin,
  AutoApplyRequest,
  StatsWindow,
  PluginStats,
} from './plugins.types'

// ── Query key factory ───────────────────────────────────────────────────────

export const pluginKeys = {
  all: ['plugins'] as const,
  catalog: () => [...pluginKeys.all, 'catalog'] as const,
  detail: (id: string) => [...pluginKeys.all, 'detail', id] as const,
  configStatus: (id: string) => [...pluginKeys.all, 'config-status', id] as const,
  stats: (id: string, window: StatsWindow) =>
    [...pluginKeys.all, 'stats', id, window] as const,
  runnable: (capability?: string) =>
    [...pluginKeys.all, 'runnable', capability ?? null] as const,
}

// ── DTO to view mapping ─────────────────────────────────────────────────────

function parseManifest(raw: Record<string, unknown>): PluginManifest {
  if (!raw || typeof raw !== 'object') return {}
  return {
    name: (raw as { name?: string }).name,
    description: (raw as { description?: string }).description,
    version: (raw as { version?: string }).version,
    permissions: (raw as { permissions?: string[] }).permissions,
    triggers: (raw as { triggers?: { cron?: string; event?: string[] }[] }).triggers,
    schedule: (raw as { schedule?: string }).schedule,
    configuration: (raw as { configuration?: PluginConfigParam[] }).configuration,
    result_ttl_seconds: (raw as { result_ttl_seconds?: number }).result_ttl_seconds,
    max_tlp: (raw as { max_tlp?: number }).max_tlp,
    max_pap: (raw as { max_pap?: number }).max_pap,
    max_concurrent_runs: (raw as { max_concurrent_runs?: number }).max_concurrent_runs,
    timeout_seconds: (raw as { timeout_seconds?: number }).timeout_seconds,
    health_status: (raw as { health_status?: string }).health_status,
  }
}

function toPlugin(dto: PluginPublic): Plugin {
  const manifest = parseManifest(dto.manifest ?? {})
  return {
    id: dto.id,
    displayName: dto.display_name,
    description: dto.description,
    manifest,
    available: dto.available,
    runnerId: dto.runner_id,
    runnerIds: dto.runner_ids,
    enabled: dto.enabled,
    autoRunEnabled: dto.auto_run_enabled,
    autoApplyActions: dto.auto_apply_actions,
    configParams: manifest.configuration ?? [],
    configStatus: undefined,
    // Server-computed; default to true when older payloads omit it so the enable
    // toggle isn't blocked for plugins that legitimately need no configuration.
    configComplete: dto.config_complete ?? true,
  }
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export async function fetchPlugins(): Promise<Plugin[]> {
  const dtos = await api.get('plugins').json<PluginPublic[]>()
  return dtos.map(toPlugin)
}

export async function fetchPlugin(id: string): Promise<Plugin> {
  const dto = await api.get(`plugins/${id}`).json<PluginPublic>()
  return toPlugin(dto)
}

/**
 * Plugins that will actually enrich right now (org-enabled, config-complete,
 * active version installed on a healthy runner). Optional `capability` narrows
 * to plugins advertising that capability (e.g. `enrichment`).
 */
export async function fetchRunnablePlugins(
  capability?: string,
): Promise<RunnablePlugin[]> {
  const params = new URLSearchParams()
  if (capability) params.set('capability', capability)
  const qs = params.toString()
  return api.get(`plugins/runnable${qs ? `?${qs}` : ''}`).json<RunnablePlugin[]>()
}

export async function fetchConfigStatus(
  id: string,
): Promise<Record<string, ParamConfigStatus>> {
  return api
    .get(`plugins/${id}/config/status`)
    .json<Record<string, ParamConfigStatus>>()
}

/** Current org-scoped settings (secrets never returned in the clear). */
export async function fetchPluginConfig(id: string): Promise<ConfigResponse> {
  return api.get(`plugins/${id}/config`).json<ConfigResponse>()
}

export const pluginConfigQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: [...pluginKeys.detail(id ?? ''), 'config'] as const,
    queryFn: () => fetchPluginConfig(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })

export const configStatusQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: pluginKeys.configStatus(id ?? ''),
    queryFn: () => fetchConfigStatus(id as string),
    enabled: id !== null,
    staleTime: 60_000,
  })

export async function fetchPluginStats(
  id: string,
  window: StatsWindow = '7d',
): Promise<PluginStats> {
  return api
    .get(`plugins/${id}/stats?window=${window}`)
    .json<PluginStats>()
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function savePluginConfig(
  id: string,
  payload: ConfigPayload,
): Promise<ConfigResponse> {
  return api
    .put(`plugins/${id}/config`, { json: payload })
    .json<ConfigResponse>()
}

export async function testPluginConfig(
  id: string,
): Promise<ConfigTestResponse> {
  return api
    .post(`plugins/${id}/config/test`)
    .json<ConfigTestResponse>()
}

export async function setPluginEnabled(
  id: string,
  enabled: boolean,
): Promise<Plugin> {
  const action = enabled ? 'enable' : 'disable'
  const dto = await api
    .post(`plugins/${id}/${action}`)
    .json<PluginPublic>()
  return toPlugin(dto)
}

export async function setAutoRunEnabled(
  id: string,
  enabled: boolean,
): Promise<Plugin> {
  const action = enabled ? 'auto-run/enable' : 'auto-run/disable'
  const dto = await api
    .post(`plugins/${id}/${action}`)
    .json<PluginPublic>()
  return toPlugin(dto)
}

export async function setAutoApplyActions(
  id: string,
  actions: string[],
): Promise<Plugin> {
  const dto = await api
    .put(`plugins/${id}/auto-apply`, { json: { actions } satisfies AutoApplyRequest })
    .json<PluginPublic>()
  return toPlugin(dto)
}

export async function runPlugin(
  id: string,
  request: RunPluginRequest,
): Promise<{ id: string }> {
  return api
    .post(`plugins/${id}/run`, { json: request })
    .json<{ id: string }>()
}

// ── queryOptions units ──────────────────────────────────────────────────────

export const pluginsQueryOptions = () =>
  queryOptions({
    queryKey: pluginKeys.catalog(),
    queryFn: fetchPlugins,
  })

export const pluginDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: pluginKeys.detail(id),
    queryFn: () => fetchPlugin(id),
  })

export const runnablePluginsQueryOptions = (capability?: string) =>
  queryOptions({
    queryKey: pluginKeys.runnable(capability),
    queryFn: () => fetchRunnablePlugins(capability),
    staleTime: 30_000,
  })
