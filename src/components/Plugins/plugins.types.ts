// ── Plugin domain types ─────────────────────────────────────────────────────

export type PluginRunnerStatus = 'healthy' | 'unhealthy' | 'offline'

export type PluginRunStatus =
  | 'queued'
  | 'accepted'
  | 'running'
  | 'success'
  | 'failure'
  | 'timeout'
  | 'cancelled'
  | 'cancelling'
  | 'skipped'

export type ProposedActionStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'failed'
  | 'expired'
  | 'superseded'

export type ProposedActionType =
  | 'add_tag'
  | 'create_task'
  | 'append_task_log'
  | 'add_related_observable'
  | 'change_severity_status'
  | 'patch_case_description'
  | 'execute_responder_action'

export type RunnerEnrollmentState = 'pending' | 'enrolled'

export type PluginVersionStatus = 'installed' | 'active' | 'failed'

export type PluginEventDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'expired'

export type SkipReason = 'fresh_result' | 'tlp_exceeded' | 'pap_exceeded'

export type StatsWindow = '7d' | '30d' | '90d'

export type PluginTab = 'all' | 'enabled' | 'disabled'

// ── Config status (server-owned, per-parameter) ─────────────────────────────

export type ConfigStatusValue = 'configured' | 'missing' | 'invalid'
export type ConfigSource = 'org' | 'default' | 'environment'

export type ParamConfigStatus = {
  status: ConfigStatusValue
  source: ConfigSource
  /** Set when the param is a secret and a value is stored server-side. */
  secret_configured?: boolean
}

// ── Manifest / configuration schema types ───────────────────────────────────

export type PluginConfigParam = {
  name: string
  description?: string
  type?: string
  required?: boolean
  defaultValue?: unknown
  /**
   * Server manifests flag secrets with a boolean alongside `type` (e.g.
   * `{type: "string", secret: true}`), not `type: "secret"`. Support both.
   */
  secret?: boolean
  /** Read from environment — client cannot edit. */
  source?: ConfigSource
  choices?: string[]
  min?: number
  max?: number
  pattern?: string
  multiline?: boolean
}

export type PluginManifest = {
  name?: string
  description?: string
  version?: string
  permissions?: string[]
  triggers?: { cron?: string; event?: string[] }[]
  schedule?: string
  configuration?: PluginConfigParam[]
  result_ttl_seconds?: number
  max_tlp?: number
  max_pap?: number
  max_concurrent_runs?: number
  timeout_seconds?: number
  health_status?: string
}

// ── DTOs (mirror backend wire shapes) ───────────────────────────────────────

export type PluginPublic = {
  id: string
  display_name: string
  description: string
  manifest: Record<string, unknown>
  available: boolean
  runner_id: string | null
  runner_ids: string[]
  enabled: boolean
  auto_run_enabled: boolean
  auto_apply_actions: string[]
  /** Server-computed: every required parameter is satisfied. */
  config_complete?: boolean
}

export type PluginRunPublic = {
  id: string
  event_id: string
  event_type: string
  organisation_id: string
  plugin_id: string
  plugin_version_id: string
  runner_id: string
  event_object_type: string | null
  event_object_id: string | null
  status: string
  skip_reason: string | null
  started_at: string | null
  ended_at: string | null
  error: string | null
  result_summary: Record<string, unknown> | null
  operation_count: number
  created_at: string | null
}

export type PluginRunnerPublic = {
  id: string
  name: string
  base_url: string
  status: string
  version: string
  isolation_mode: string
  last_health_at: string | null
  last_heartbeat_at: string | null
  created_at: string | null
}

export type CreateRunnerResponse = {
  id: string
  name: string
  status: string
  enrollment_state: string
  enrollment_token: string
  enrollment_token_expires_at: string
}

export type PluginStats = {
  window: string
  success: number
  failure: number
  timeout: number
  skipped: number
  total: number
  success_rate: number | null
  avg_duration_ms: number | null
  plugin_id: string
}

export type RunnerStats = {
  window: string
  success: number
  failure: number
  timeout: number
  skipped: number
  total: number
  success_rate: number | null
  avg_duration_ms: number | null
  runner_id: string
}

export type ProposedActionPublic = {
  id: string
  plugin_id: string
  plugin_run_id: string
  action_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  status: string
  decision_reason: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string | null
}

// ── UI domain types (after DTO mapping) ─────────────────────────────────────

export type Plugin = {
  id: string
  displayName: string
  description: string
  manifest: PluginManifest
  available: boolean
  runnerId: string | null
  runnerIds: string[]
  enabled: boolean
  autoRunEnabled: boolean
  autoApplyActions: string[]
  /** Computed from manifest. */
  configParams: PluginConfigParam[]
  /** Server-owned config status per parameter. */
  configStatus?: Record<string, ParamConfigStatus>
  /** Server-computed: every required parameter is satisfied. */
  configComplete: boolean
}

export type PluginRun = {
  id: string
  eventId: string
  eventType: string
  organisationId: string
  pluginId: string
  pluginVersionId: string
  runnerId: string
  eventObjectType: string | null
  eventObjectId: string | null
  status: PluginRunStatus
  skipReason: SkipReason | null
  startedAt: string | null
  endedAt: string | null
  error: string | null
  resultSummary: Record<string, unknown> | null
  operationCount: number
  createdAt: string | null
}

export type PluginRunner = {
  id: string
  name: string
  baseUrl: string
  status: PluginRunnerStatus
  version: string
  isolationMode: string
  lastHealthAt: string | null
  lastHeartbeatAt: string | null
  createdAt: string | null
}

export type ProposedAction = {
  id: string
  pluginId: string
  pluginRunId: string
  actionType: ProposedActionType
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  status: ProposedActionStatus
  decisionReason: string | null
  decidedBy: string | null
  decidedAt: string | null
  createdAt: string | null
}

// ── Request/response payloads ───────────────────────────────────────────────

export type ConfigPayload = {
  settings?: Record<string, unknown>
  secrets?: Record<string, string | null>
}

export type ConfigResponse = {
  settings: Record<string, unknown>
  has_secrets: boolean
}

export type ConfigTestResponse = {
  ok: boolean
  message: string
  log_tail?: string
}

export type RunPluginRequest = {
  entity_type: string
  entity_id: string
}

/**
 * A plugin that will actually enrich right now — server-filtered to org-enabled,
 * config-complete, active-version plugins installed on a healthy runner.
 * Returned by `GET /plugins/runnable`; populates the analyzer picker.
 */
export type RunnablePlugin = {
  id: string
  name: string
  description: string
  capabilities: string[]
}

/** Body for `POST /observables/{id}/plugin-runs`. */
export type QueueObservablePluginRunRequest = {
  plugin_id: string
  force?: boolean
}

export type AutoApplyRequest = {
  actions: string[]
}

export type CreateRunnerRequest = {
  id: string
  name?: string
  base_url?: string
}

export type PluginRunFilter = {
  skip?: number
  limit?: number
  status?: PluginRunStatus
  plugin_id?: string
  runner_id?: string
  organisation_id?: string
}

export type ProposedActionFilter = {
  entity_type?: string
  entity_id?: string
  plugin_id?: string
  status?: ProposedActionStatus
}
