// ── Plugin result (evidence) domain types ───────────────────────────────────
//
// These model the append-only `PluginResult` evidence rows returned by the
// entity-side read routes (`GET /{entity}/{id}/plugin-results`), NOT plugin
// *runs*. Field names/casing mirror `app/crud/plugin_result.py::public`.

/** Entities that can carry plugin evidence and expose a plugin-results route. */
export type PluginResultEntityType = 'observable' | 'case' | 'alert'

/** Controlled verdict vocabulary (plan: "Plugin Result And Evidence Model"). */
export type Verdict =
  | 'unknown'
  | 'info'
  | 'benign'
  | 'suspicious'
  | 'malicious'
  | 'error'

export const VERDICTS: readonly Verdict[] = [
  'unknown',
  'info',
  'benign',
  'suspicious',
  'malicious',
  'error',
]

/**
 * The render modes we render natively. The backend `render_mode` is a free
 * string hint; anything outside this set falls back to `json` (see
 * `resolveRenderMode`). The plan's `map`/`timeline`/`graph`/`finding_list`
 * hints are intentionally not bespoke-rendered yet and land on the JSON view.
 */
export type SupportedRenderMode = 'markdown' | 'json' | 'table' | 'key_value'

/** Attachment metadata as stored — passed through verbatim, no download URL. */
export type PluginAttachmentPublic = {
  file_ref?: string
  filename?: string
  content_type?: string
  size?: number
  sha256?: string
}

export type PluginAttachment = {
  fileRef: string | null
  filename: string | null
  contentType: string | null
  size: number | null
  sha256: string | null
}

// ── Wire DTO (mirrors the serializer) ───────────────────────────────────────

export type PluginResultPublic = {
  id: string
  plugin_run_id: string | null
  organisation_id: string
  plugin_id: string
  plugin_version_id: string
  entity_type: string
  entity_id: string
  source: string
  verdict: string | null
  confidence: number | null
  render_mode: string
  title: string | null
  summary: string | null
  normalized_data: Record<string, unknown> | null
  result_metadata: Record<string, unknown> | null
  attachments: PluginAttachmentPublic[]
  fingerprint: string
  expires_at: string | null
  created_at: string
  stale: boolean
  latest: boolean
  /** Present because the list serializer includes raw by default. */
  raw_data?: Record<string, unknown> | null
}

// ── UI domain type (after DTO mapping) ──────────────────────────────────────

export type PluginResult = {
  id: string
  pluginRunId: string | null
  organisationId: string
  pluginId: string
  pluginVersionId: string
  entityType: string
  entityId: string
  source: string
  verdict: Verdict
  confidence: number | null
  renderMode: string
  title: string | null
  summary: string | null
  normalizedData: Record<string, unknown> | null
  resultMetadata: Record<string, unknown> | null
  attachments: PluginAttachment[]
  fingerprint: string
  expiresAt: string | null
  createdAt: string
  /** Server-computed: `expires_at` is in the past. Never hidden, only flagged. */
  stale: boolean
  /** Server-computed: newest result for its `(pluginId, source)` supersession key. */
  latest: boolean
  rawData: Record<string, unknown> | null
}

// ── Grouping shapes (plugin → source → latest + history) ─────────────────────

export type SourceGroup = {
  source: string
  /** Newest result for this plugin+source. */
  latest: PluginResult
  /** Older results, newest-first, behind a history affordance. */
  history: PluginResult[]
}

export type PluginGroup = {
  pluginId: string
  sources: SourceGroup[]
}
