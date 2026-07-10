import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type {
  PluginAttachment,
  PluginAttachmentPublic,
  PluginGroup,
  PluginResult,
  PluginResultEntityType,
  PluginResultPublic,
  SourceGroup,
  SupportedRenderMode,
  Verdict,
} from './pluginResults.types'
import { VERDICTS } from './pluginResults.types'

// ── Query key factory ───────────────────────────────────────────────────────

export const pluginResultKeys = {
  all: ['plugin-results'] as const,
  list: (entityType: PluginResultEntityType, entityId: string) =>
    [...pluginResultKeys.all, entityType, entityId] as const,
}

// ── Endpoint routing ────────────────────────────────────────────────────────

/** Path segment carrying the entity's plugin-results list, per entity type. */
function endpointFor(
  entityType: PluginResultEntityType,
  entityId: string,
): string {
  switch (entityType) {
    case 'observable':
      return `observables/${entityId}/plugin-results`
    case 'case':
      return `cases/${entityId}/plugin-results`
    case 'alert':
      return `alerts/${entityId}/plugin-results`
  }
}

// ── DTO to domain mapping ────────────────────────────────────────────────────

const VERDICT_SET = new Set<string>(VERDICTS)

/** Coerce the free-string verdict to the controlled vocabulary. */
export function toVerdict(raw: string | null | undefined): Verdict {
  if (raw && VERDICT_SET.has(raw)) return raw as Verdict
  return 'unknown'
}

function toAttachment(dto: PluginAttachmentPublic): PluginAttachment {
  return {
    fileRef: dto.file_ref ?? null,
    filename: dto.filename ?? null,
    contentType: dto.content_type ?? null,
    size: typeof dto.size === 'number' ? dto.size : null,
    sha256: dto.sha256 ?? null,
  }
}

export function toPluginResult(dto: PluginResultPublic): PluginResult {
  return {
    id: dto.id,
    pluginRunId: dto.plugin_run_id,
    organisationId: dto.organisation_id,
    pluginId: dto.plugin_id,
    pluginVersionId: dto.plugin_version_id,
    entityType: dto.entity_type,
    entityId: dto.entity_id,
    source: dto.source,
    verdict: toVerdict(dto.verdict),
    confidence: typeof dto.confidence === 'number' ? dto.confidence : null,
    renderMode: dto.render_mode,
    title: dto.title,
    summary: dto.summary,
    normalizedData: dto.normalized_data,
    resultMetadata: dto.result_metadata,
    attachments: Array.isArray(dto.attachments)
      ? dto.attachments.map(toAttachment)
      : [],
    fingerprint: dto.fingerprint,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
    stale: dto.stale === true,
    latest: dto.latest === true,
    rawData: dto.raw_data ?? null,
  }
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

const SUPPORTED_RENDER_MODES = new Set<SupportedRenderMode>([
  'markdown',
  'json',
  'table',
  'key_value',
])

/**
 * Resolve a backend `render_mode` hint to a mode we render natively. Supported
 * modes pass through; every other hint (incl. `map`/`timeline`/`graph`/
 * `finding_list` and any unknown value) falls back to `json`.
 */
export function resolveRenderMode(mode: string): SupportedRenderMode {
  return SUPPORTED_RENDER_MODES.has(mode as SupportedRenderMode)
    ? (mode as SupportedRenderMode)
    : 'json'
}

/**
 * Extract the Markdown body for a `markdown`-mode result. There is no dedicated
 * `markdown` column — plugins carry it inside `normalized_data` (commonly under
 * `markdown`/`content`/`body`). Falls back to the plain `summary` text, else
 * null. Returned text is rendered through a schema-based renderer, never raw
 * HTML (see `MarkdownView`).
 */
export function markdownBody(result: PluginResult): string | null {
  const nd = result.normalizedData
  if (nd && typeof nd === 'object') {
    for (const key of ['markdown', 'content', 'body'] as const) {
      const value = (nd as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
  }
  if (typeof result.summary === 'string' && result.summary.length > 0) {
    return result.summary
  }
  return null
}

/**
 * Group results by plugin, then by source, preserving newest-first order. The
 * input must already be newest-first (the API guarantees this), so the first
 * result seen for each `(pluginId, source)` is its latest and the rest are
 * history. Plugin and source order follow first appearance (newest activity
 * first).
 */
export function groupResults(results: PluginResult[]): PluginGroup[] {
  const plugins = new Map<string, Map<string, PluginResult[]>>()
  for (const result of results) {
    let sources = plugins.get(result.pluginId)
    if (!sources) {
      sources = new Map<string, PluginResult[]>()
      plugins.set(result.pluginId, sources)
    }
    const bucket = sources.get(result.source)
    if (bucket) bucket.push(result)
    else sources.set(result.source, [result])
  }

  const groups: PluginGroup[] = []
  for (const [pluginId, sources] of plugins) {
    const sourceGroups: SourceGroup[] = []
    for (const [source, bucket] of sources) {
      const [latest, ...history] = bucket
      // `latest` is defined: a source key only exists because ≥1 result created it.
      sourceGroups.push({ source, latest: latest as PluginResult, history })
    }
    groups.push({ pluginId, sources: sourceGroups })
  }
  return groups
}

// ── Fetcher + queryOptions ───────────────────────────────────────────────────

export async function fetchPluginResults(
  entityType: PluginResultEntityType,
  entityId: string,
): Promise<PluginResult[]> {
  const dtos = await api
    .get(endpointFor(entityType, entityId))
    .json<PluginResultPublic[]>()
  return dtos.map(toPluginResult)
}

export const pluginResultsQueryOptions = (
  entityType: PluginResultEntityType,
  entityId: string,
) =>
  queryOptions({
    queryKey: pluginResultKeys.list(entityType, entityId),
    queryFn: () => fetchPluginResults(entityType, entityId),
  })

// ── Attachment download ──────────────────────────────────────────────────────

/**
 * Path (relative to the ky base URL) of a plugin attachment's authenticated
 * download route: `<entity>/plugin-results/files/{file_ref}`.
 *
 * `file_ref` is a Starlette `:path` param, so `/` inside it must survive as a
 * literal path separator for the route to match. We therefore encode each
 * `/`-separated segment independently and re-join with `/`: special characters
 * (e.g. the `:` in the `plugin-run-file:<uuid>` scheme) are percent-encoded,
 * while any embedded slash is preserved.
 */
export function attachmentDownloadPath(
  entityType: PluginResultEntityType,
  entityId: string,
  fileRef: string,
): string {
  const encodedRef = fileRef.split('/').map(encodeURIComponent).join('/')
  return `${endpointFor(entityType, entityId)}/files/${encodedRef}`
}

/**
 * Download a plugin attachment through the authenticated API client and hand the
 * bytes to the browser as a file.
 *
 * A bare `<a href>` cannot be used: auth is a JWT `Authorization: Bearer` header
 * attached by the ky client (see `#/lib/api/client`), not a cookie, so a plain
 * link would be sent unauthenticated and 401. We fetch the blob through `api`
 * (which carries the header) and trigger the save from an object URL, revoking
 * it afterwards. The response is always `application/octet-stream` with
 * `Content-Disposition: attachment` — content is never rendered inline.
 *
 * Rejects (ky `HTTPError`) on a non-2xx response so callers can surface a
 * failure; the object URL is only created after a successful fetch.
 */
export async function downloadPluginAttachment(
  entityType: PluginResultEntityType,
  entityId: string,
  fileRef: string,
  filename: string,
): Promise<void> {
  const blob = await api
    .get(attachmentDownloadPath(entityType, entityId, fileRef))
    .blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
