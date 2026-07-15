/**
 * Data-fetching layer for Cases — follows the project's TanStack Query pattern
 * (see docs/data-fetching.md and alertsQueries.ts for the reference):
 *
 *   1. a query-key factory  (`caseKeys`)
 *   2. fetchers + DTO mapping (`fetchCases`, `toCase`)
 *   3. `queryOptions` units (`casesQueryOptions`, `caseQueryOptions`)
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import type { HTTPError } from 'ky'
import { api, API_BASE } from '#/lib/api/client'
import { toAssigneeRefs } from '#/components/Assign/assignees'
import { getActiveOrgId } from '#/lib/auth/session'
import { appendClauses } from '#/lib/filters'
import type { FilterClause, FilterOp } from '#/lib/filters'
import type { CaseStatus, Severity, Tlp } from '#/lib/domain'
import type { MemberPublic } from './caseUsers'
import type {
  AlertPublic,
  AuditPublic,
  CasePublic,
  CommentPublic,
  ObservablePublic,
  TaskPublic,
  WorkLogPublic,
} from './caseDetails'
import {
  compactTime,
  toCaseDetail,
  toCaseDetailAttachment,
  toCaseDetailObservables,
  toCaseDetailTaskLog,
  toCaseDetailTaskLogs,
  toCaseDetailTasks,
  toCaseDetailTimeline,
} from './caseDetails'
import type {
  CaseDetail,
  CaseDetailAttachment,
  CaseDetailComment,
  CaseDetailObservable,
  CaseDetailTask,
  CaseDetailTaskLog,
  CaseDetailTimelineEvent,
} from './caseDetails.types'
import type { Case } from './cases.types'
import type { SimilarCaseRow } from './SimilarCaseTable'
import type {
  PluginRunPublic,
  QueuePluginRunRequest,
} from '#/components/Plugins/plugins.types'

/** Mirrors the backend AttachmentPublic model. */
export type AttachmentPublic = {
  /** Numeric per-case attachment id (composite key part). */
  id: number
  public_id: string
  case_id: number
  attachment_id: string
  owner_type: string
  owner_task_id: number | null
  owner_log_id: number | null
  name: string
  size: number
  content_type: string
  sha256: string
  organisation_id: string
  created_at: string
  created_by: string
}

/** Column the list is sorted by, server-side. */
export type CaseSort = 'id' | 'created' | 'updated'

// Shared filter primitives, re-exported for existing importers of this module.
export type { FilterOp, FilterClause }

/**
 * The complete query the cases list sends to the backend: filters (every field
 * is OR-within / AND-across), the sort, and the page window. Empty/omitted
 * fields impose no constraint. This is the single source of truth for both the
 * query key and the request, so two calls with the same filters share a cache
 * entry.
 */
export type CaseListFilters = {
  /** Filter clauses (OR-within-key, AND-across-key). Omitted ⇒ no constraint. */
  clauses?: FilterClause[]
  sort?: CaseSort
  order?: 'asc' | 'desc'
  skip?: number
  limit?: number
}

/**
 * Initial query for the list view — newest first, first page of 10. Shared by
 * the route loader's prefetch and the page's initial state so the first paint
 * reads a warm cache (same filters ⇒ same query key).
 */
export const DEFAULT_CASE_FILTERS: CaseListFilters = {
  sort: 'id',
  order: 'desc',
  skip: 0,
  limit: 10,
}

/** A page of mapped cases plus the server's total (for pagination). */
export type CasesResult = { cases: Case[]; total: number }

export type CreateCaseInput = {
  title: string
  description?: string
  severity?: number
  tlp?: number
  pap?: number
  assigneeId?: string | null
  summary?: string | null
  caseTemplateId?: number | null
  tags?: string[]
  customFields?: Record<string, unknown>
}

export type CreatedCaseResult = {
  id: string
  numericId: number
  case: Case
}

/**
 * Hierarchical query-key factory. Always derive keys here — never hand-write
 * an array at a call site. The hierarchy lets you invalidate broadly
 * (`caseKeys.all`) or narrowly (`caseKeys.detail(id)`).
 */
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: CaseListFilters = {}) =>
    [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
  fullDetail: (id: string) => [...caseKeys.detail(id), 'full'] as const,
  counts: (id: string) => [...caseKeys.detail(id), 'counts'] as const,
  tasks: (id: string) => [...caseKeys.detail(id), 'tasks'] as const,
  taskLogs: (id: string, taskId: number) =>
    [...caseKeys.detail(id), 'tasks', taskId, 'logs'] as const,
  observables: (id: string) => [...caseKeys.detail(id), 'observables'] as const,
  attachments: (id: string) => [...caseKeys.detail(id), 'attachments'] as const,
  timeline: (id: string) => [...caseKeys.detail(id), 'timeline'] as const,
  similar: (id: string) => [...caseKeys.detail(id), 'similar'] as const,
  customFieldValues: (id: string) =>
    [...caseKeys.detail(id), 'custom-field-values'] as const,
  // With no sortOrder this is the prefix key — invalidating it clears every
  // sort variant; the queryFn always passes a concrete order.
  comments: (id: string, sortOrder?: string) =>
    sortOrder === undefined
      ? ([...caseKeys.detail(id), 'comments'] as const)
      : ([...caseKeys.detail(id), 'comments', sortOrder] as const),
}

// --- Cache invalidation ------------------------------------------------------
// Each per-panel section is its own query, so mutations must invalidate the
// affected section plus the badge counts (and the timeline, which aggregates
// tasks/comments). These helpers keep those fan-outs in one place.

/** Tasks changed: refresh the tasks list, badge counts, timeline. */
export function invalidateTaskQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.tasks(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.counts(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
}

/**
 * A work-log changed: refresh the task's logs and the tasks list (its
 * `log_count` hint), plus the timeline. `caseKeys.tasks` is a prefix of
 * `caseKeys.taskLogs`, so invalidating it also clears the open task's logs.
 */
export function invalidateWorkLogQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.tasks(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
}

/** Comments changed: refresh the comments list, badge counts, timeline. */
export function invalidateCommentQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.comments(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.counts(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.timeline(caseId) })
}

/** Observables changed: refresh the observables list and badge counts. */
export function invalidateObservableQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.observables(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.counts(caseId) })
}

/** Attachments changed: refresh the attachments list and badge counts. */
export function invalidateAttachmentQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.attachments(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.counts(caseId) })
}

/**
 * Custom-field values changed: refresh the raw values, the badge counts, and the
 * full case detail (whose `customFields` render the read-only summary rows).
 */
export function invalidateCustomFieldQueries(qc: QueryClient, caseId: string) {
  qc.invalidateQueries({ queryKey: caseKeys.customFieldValues(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.counts(caseId) })
  qc.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
}

// --- API DTOs --------------------------------------------------------------
// Mirrors the backend `Page[CasePublic]` shape (app/models/case_.py).

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

// Backend status enum → UI status id + display name. The backend has a
// narrower set (Open/Resolved/Duplicated) than the UI's prototype palette.
const STATUS_MAP: Record<string, { id: CaseStatus; name: string }> = {
  Open: { id: 'open', name: 'Open' },
  Resolved: { id: 'resolved', name: 'Resolved' },
  Duplicated: { id: 'duplicated', name: 'Duplicated' },
}

// Minutes → compact relative stamp ("8m" / "3h" / "2d"). Must match the
// `^(\d+)\s*([mhd])$` shape the list view's "Updated" sort parser expects.
function relativeStamp(iso: string): string {
  const min = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
  )
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

/**
 * Map a backend `CasePublic` to the UI `Case`. The list endpoint embeds tags,
 * the resolved assignee email, and a slim task list — from which we derive
 * progress here (the backend stays count-agnostic). Cancelled tasks drop out
 * of the total so the progress bar can still reach 100%.
 */
function toCase(c: CasePublic): Case {
  const status = STATUS_MAP[c.status] ?? { id: 'open', name: c.status }
  const activeTasks = c.tasks.filter((t) => t.status !== 'Cancelled')
  return {
    id: `#${c.id}`,
    sev: clamp(c.severity, 1, 4) as Severity,
    tlp: clamp(c.tlp, 0, 3) as Tlp,
    pap: clamp(c.pap, 0, 3) as Tlp,
    status: status.id,
    statusName: status.name,
    title: c.title,
    assignee: c.assignee_email ?? 'Unassigned',
    assignees: toAssigneeRefs(c.assignees),
    tags: c.tags,
    tasksDone: activeTasks.filter((t) => t.status === 'Completed').length,
    tasksTotal: activeTasks.length,
    created: relativeStamp(c.created_at),
    updated: relativeStamp(c.updated_at ?? c.created_at),
    createdAt: c.created_at,
    updatedAt: c.updated_at ?? c.created_at,
    slaDueAt: c.sla_due_at,
    slaState: c.sla_state,
    ...(c.duplicate_of_case_id != null
      ? { duplicateOf: `#${c.duplicate_of_case_id}` }
      : {}),
  }
}

// --- fetchers --------------------------------------------------------------

async function fetchCases(filters: CaseListFilters): Promise<CasesResult> {
  const params = new URLSearchParams()
  appendClauses(params, filters.clauses)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const page = await api
    .get('cases/', { searchParams: params })
    .json<Page<CasePublic>>()
  return { cases: page.items.map(toCase), total: page.total }
}

/** Filterable values across the org's cases, powering the filter dropdowns. */
export type CaseFacets = {
  assignees: string[]
  unassigned: boolean
  /** Tag key → its distinct values (value-aware grouping; free tags excluded). */
  tagKeys: Record<string, string[]>
}

type CaseFacetsDTO = {
  assignees: string[]
  unassigned: boolean
  tag_keys: Record<string, string[]>
}

async function fetchCaseFacets(): Promise<CaseFacets> {
  const raw = await api.get('cases/filters').json<CaseFacetsDTO>()
  return {
    assignees: raw.assignees,
    unassigned: raw.unassigned,
    tagKeys: raw.tag_keys,
  }
}

export async function createCaseFromTemplate(
  input: CreateCaseInput,
): Promise<CreatedCaseResult> {
  const caseItem = await api
    .post('cases/', {
      json: {
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        severity: input.severity,
        tlp: input.tlp,
        pap: input.pap,
        assignee_id: input.assigneeId ?? null,
        summary: input.summary ?? null,
        case_template_id: input.caseTemplateId ?? null,
      },
    })
    .json<CasePublic>()

  const caseId = String(caseItem.id)
  if (input.tags) {
    await api.put(`cases/${caseId}/tags`, { json: { tags: input.tags } })
  }

  const customFields = input.customFields ?? {}
  if (Object.keys(customFields).length > 0) {
    await api.put(`cases/${caseId}/custom-fields`, {
      json: { values: customFields },
    })
  }

  return {
    id: `#${caseItem.id}`,
    numericId: caseItem.id,
    case: toCase(caseItem),
  }
}

/**
 * Input for a case-to-case merge. `sourceIds` are the display ids ("#12") of
 * the 2+ cases being merged; `case` is the survivor to create (the human-edited
 * form). The backend floors the survivor's tlp/pap to the most restrictive of
 * the sources — the dialog mirrors that guard client-side.
 */
export type MergeCasesInput = {
  sourceIds: string[]
  case: {
    title: string
    description?: string
    severity: number
    tlp: number
    pap: number
    assigneeId?: string | null
    summary?: string | null
  }
}

/**
 * Read the `detail` out of a FastAPI error body — a plain string (our custom
 * 4xx/409s) or the validation-array shape (`[{ msg, loc }, …]`).
 */
function readDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msgs = detail.map((entry) =>
      entry && typeof entry === 'object' && 'msg' in entry
        ? String((entry as { msg: unknown }).msg)
        : String(entry),
    )
    return msgs.join('; ') || null
  }
  return null
}

/** Pull a human-readable message out of a FastAPI error body (`detail`). */
async function extractErrorDetail(error: HTTPError): Promise<string | null> {
  // ky pre-parses the response body into `error.data` (consuming the stream),
  // so prefer it; fall back to reading the response for older ky / tests.
  const fromData = readDetail((error as { data?: unknown }).data)
  if (fromData) return fromData
  try {
    return readDetail(await error.response.json())
  } catch {
    return null
  }
}

/**
 * Merge 2+ source cases into a fresh survivor case via POST /cases/merge. The
 * sources become read-only tombstones (status Duplicated) and their children
 * reparent to the survivor. Backend errors (409 already-merged, 4xx tlp/pap
 * floor violation) are re-thrown with the server's `detail` as the message so
 * callers can surface it directly.
 */
export async function mergeCases(
  input: MergeCasesInput,
): Promise<CreatedCaseResult> {
  try {
    const survivor = await api
      .post('cases/merge', {
        json: {
          source_ids: input.sourceIds.map((id) => Number(id.replace(/^#/, ''))),
          case: {
            title: input.case.title.trim(),
            description: input.case.description?.trim() ?? '',
            severity: input.case.severity,
            tlp: input.case.tlp,
            pap: input.case.pap,
            assignee_id: input.case.assigneeId ?? null,
            summary: input.case.summary?.trim() || null,
          },
        },
      })
      .json<CasePublic>()
    return {
      id: `#${survivor.id}`,
      numericId: survivor.id,
      case: toCase(survivor),
    }
  } catch (error) {
    if (isHTTPError(error)) {
      const detail = await extractErrorDetail(error)
      if (detail) throw new Error(detail)
    }
    throw error
  }
}

/**
 * Persist an edited case description (Markdown) via PATCH /cases/{id}. The
 * caller is responsible for invalidating `caseKeys.detail(id)` /
 * `fullDetail(id)` so the refetched case reflects the saved value.
 */
export async function updateCaseDescription(
  id: string,
  descriptionMarkdown: string,
): Promise<void> {
  const numeric = id.replace(/^#/, '')
  await api.patch(`cases/${numeric}`, {
    json: { description: descriptionMarkdown },
  })
}

export async function updateCaseAssignee(
  id: string,
  assigneeId: string | null,
): Promise<void> {
  const numeric = id.replace(/^#/, '')
  await api.patch(`cases/${numeric}`, {
    json: { assignee_id: assigneeId },
  })
}

export async function closeCase(id: string): Promise<void> {
  const numeric = id.replace(/^#/, '')
  await api.patch(`cases/${numeric}`, {
    json: { status: 'Resolved' },
  })
}

/**
 * Queue one manual plugin run against a case — e.g. a responder the analyst
 * fires by hand. Mirrors `queueObservablePluginRun`, but the target is the case
 * itself (responders act on the whole case, not a single observable), so there is
 * no fan-out over observables. `force: true` bypasses the dedup no-op. Returns
 * the server's synthetic queued-run view.
 */
export async function queueCasePluginRun(
  id: string,
  body: QueuePluginRunRequest,
): Promise<PluginRunPublic> {
  const numeric = id.replace(/^#/, '')
  return api
    .post(`cases/${numeric}/plugin-runs`, { json: body })
    .json<PluginRunPublic>()
}

export async function setCaseTags(id: string, tags: string[]): Promise<void> {
  const numeric = id.replace(/^#/, '')
  await api.put(`cases/${numeric}/tags`, { json: { tags } })
}

export async function createCaseTask(
  caseId: string,
  title: string,
): Promise<TaskPublic> {
  const numeric = caseId.replace(/^#/, '')
  return api
    .post(`cases/${numeric}/tasks`, { json: { title: title.trim() } })
    .json<TaskPublic>()
}

export async function updateTaskDetailFields({
  caseId,
  taskId,
  description,
  status,
}: {
  caseId: number
  taskId: number
  description?: string
  status?: CaseDetailTask['status']
}) {
  const json: Record<string, string> = {}
  if (description != null) json.description = description
  if (status != null) {
    json.status = {
      waiting: 'Waiting',
      inprogress: 'InProgress',
      completed: 'Completed',
      cancel: 'Cancelled',
    }[status]
  }
  await api.patch(`cases/${caseId}/tasks/${taskId}`, { json })
}

export async function createTaskWorkLog({
  caseId,
  taskId,
  bodyMarkdown,
  files = [],
}: {
  caseId: number
  taskId: number
  bodyMarkdown: string
  files?: File[]
}) {
  const base = `cases/${caseId}/tasks/${taskId}/logs`
  const log = await api
    .post(base, {
      json: { message: bodyMarkdown },
    })
    .json<WorkLogPublic>()

  for (const file of files) {
    const body = new FormData()
    body.append('file', file)
    await api.post(`${base}/${log.id}/attachments`, { body })
  }

  return toCaseDetailTaskLog(log)
}

export async function updateTaskWorkLog({
  caseId,
  taskId,
  logId,
  bodyMarkdown,
}: {
  caseId: number
  taskId: number
  logId: number
  bodyMarkdown: string
}) {
  const log = await api
    .patch(`cases/${caseId}/tasks/${taskId}/logs/${logId}`, {
      json: { message: bodyMarkdown },
    })
    .json<WorkLogPublic>()

  return toCaseDetailTaskLog(log)
}

export async function deleteTaskWorkLog({
  caseId,
  taskId,
  logId,
}: {
  caseId: number
  taskId: number
  logId: number
}): Promise<void> {
  await api.delete(`cases/${caseId}/tasks/${taskId}/logs/${logId}`)
}

export async function createCaseComment(
  caseId: string,
  message: string,
): Promise<void> {
  const numeric = caseId.replace(/^#/, '')
  await api.post(`cases/${numeric}/comments`, { json: { message } })
}

export async function updateCaseComment(
  commentId: string,
  message: string,
): Promise<void> {
  await api.patch(`comments/${commentId}`, { json: { message } })
}

export async function deleteCaseComment(commentId: string): Promise<void> {
  await api.delete(`comments/${commentId}`)
}

export async function fetchCaseComments(
  caseId: string,
  sortOrder: string = 'desc',
): Promise<CaseDetailComment[]> {
  const numeric = caseId.replace(/^#/, '')
  const page = await api
    .get(`cases/${numeric}/comments`, {
      searchParams: { sort_order: sortOrder },
    })
    .json<Page<CommentPublic>>()
  return page.items.map((c) => ({
    id: c.id,
    author: c.author_name,
    time: compactTime(c.created_at),
    body: c.message,
  }))
}

export async function createCaseObservable(
  caseId: string,
  body: {
    observable_type: string
    data: string
    message?: string
    tlp?: number
    ioc?: boolean
    sighted?: boolean
    ignore_similarity?: boolean
  },
): Promise<ObservablePublic> {
  const numeric = caseId.replace(/^#/, '')
  return api
    .post(`cases/${numeric}/observables`, { json: body })
    .json<ObservablePublic>()
}

/**
 * Create a file-backed (attachment-type) observable via the multipart endpoint
 * `POST /cases/{id}/observables/file`. The observable's `data` is derived
 * server-side from the uploaded file's content hash. Mirrors the JSON
 * `createCaseObservable` for string observables. The backend 409s on a
 * duplicate (same case + type + file).
 */
export async function createCaseObservableFile(
  caseId: string,
  body: {
    observable_type: string
    file: File
    message?: string
    tlp?: number
    ioc?: boolean
    sighted?: boolean
  },
): Promise<ObservablePublic> {
  const numeric = caseId.replace(/^#/, '')
  const form = new FormData()
  form.append('file', body.file)
  form.append('observable_type', body.observable_type)
  if (body.message != null) form.append('message', body.message)
  if (body.tlp != null) form.append('tlp', String(body.tlp))
  if (body.ioc != null) form.append('ioc', String(body.ioc))
  if (body.sighted != null) form.append('sighted', String(body.sighted))
  return api
    .post(`cases/${numeric}/observables/file`, { body: form })
    .json<ObservablePublic>()
}

async function fetchCase(id: string): Promise<Case> {
  const numeric = id.replace(/^#/, '')
  const c = await api.get(`cases/${numeric}`).json<CasePublic>()
  return toCase(c)
}

/**
 * Fetch the core case for the always-visible summary card, side rail, and
 * Details tab, plus the alerts promoted into it (shown in the side rail's
 * "Linked alerts" panel) — fetched concurrently. The heavy per-panel sections
 * (tasks, observables, comments, attachments, timeline) are fetched lazily by
 * their own panels — see the per-section query options below.
 */
export async function fetchCaseDetail(id: string): Promise<CaseDetail> {
  const numeric = id.replace(/^#/, '')
  const [caseItem, alerts] = await Promise.all([
    api.get(`cases/${numeric}`).json<CasePublic>(),
    api.get(`cases/${numeric}/alerts`).json<Page<AlertPublic>>(),
  ])
  return toCaseDetail(caseItem, alerts.items)
}

// --- Per-section counts (tab badges) ---------------------------------------

/** Tab-badge counts for a case, mirroring the backend `CaseCounts` model. */
export type CaseCounts = {
  tasks: number
  customFields: number
  comments: number
  attachments: number
  observables: number
  similar: number
}

async function fetchCaseCounts(id: string): Promise<CaseCounts> {
  const numeric = id.replace(/^#/, '')
  const c = await api.get(`cases/${numeric}/counts`).json<{
    tasks: number
    custom_fields: number
    comments: number
    attachments: number
    observables: number
    similar: number
  }>()
  return {
    tasks: c.tasks,
    customFields: c.custom_fields,
    comments: c.comments,
    attachments: c.attachments,
    observables: c.observables,
    similar: c.similar,
  }
}

/** Mirrors the backend SimilarCasePublic (app/models/case_.py). */
type SimilarCasePublicDTO = {
  id: number
  title: string
  severity: number
  status: string
  shared_observables: number
}

/** Cases sharing one or more observables with this case (the "Similar" tab). */
async function fetchCaseSimilarCases(id: string): Promise<SimilarCaseRow[]> {
  const numeric = id.replace(/^#/, '')
  const items = await api
    .get(`cases/${numeric}/similar`)
    .json<SimilarCasePublicDTO[]>()
  return items.map((c) => ({
    id: `#${c.id}`,
    title: c.title,
    sev: clamp(c.severity, 1, 4) as Severity,
    status: c.status,
  }))
}

/** Raw custom-field values for a case (name → typed value), for the editable
 *  panel. Empty object when none are set. */
async function fetchCaseCustomFieldValues(
  id: string,
): Promise<Record<string, unknown>> {
  const numeric = id.replace(/^#/, '')
  return api
    .get(`cases/${numeric}/custom-fields`)
    .json<Record<string, unknown>>()
}

/**
 * Replace-semantics PUT of a case's custom-field values. The full desired value
 * set must be sent (the backend clears any field absent from `values` and 422s
 * when a mandatory field is missing). Throws with the server's `detail` message.
 */
export async function setCaseCustomFields(
  id: string,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const numeric = id.replace(/^#/, '')
  try {
    return await api
      .put(`cases/${numeric}/custom-fields`, { json: { values } })
      .json<Record<string, unknown>>()
  } catch (error) {
    if (isHTTPError(error)) {
      const detail = await extractErrorDetail(error)
      if (detail) throw new Error(detail)
    }
    throw error
  }
}

// --- Per-panel resources (fetched on demand when a panel mounts) ------------

/**
 * Tasks for the Tasks panel — the list only (each task carries a server-side
 * `log_count` hint). A task's work-logs load lazily via `fetchCaseTaskLogs`
 * when the task is opened, so panel open is a single request.
 */
async function fetchCaseTasks(id: string): Promise<CaseDetailTask[]> {
  const numeric = id.replace(/^#/, '')
  const tasks = await api.get(`cases/${numeric}/tasks`).json<Page<TaskPublic>>()
  return toCaseDetailTasks(tasks.items)
}

/** A single task's work-logs, fetched on demand when the task is opened. */
async function fetchCaseTaskLogs(
  id: string,
  taskId: number,
): Promise<CaseDetailTaskLog[]> {
  const numeric = id.replace(/^#/, '')
  const orgId = getActiveOrgId()
  const [logs, members] = await Promise.all([
    api
      .get(`cases/${numeric}/tasks/${taskId}/logs`)
      .json<Page<WorkLogPublic>>(),
    orgId
      ? api.get(`organisations/${orgId}/members`).json<MemberPublic[]>()
      : Promise.resolve([]),
  ])
  return toCaseDetailTaskLogs(logs.items, members)
}

/** Observables, mapped for the Observables panel. */
async function fetchCaseObservables(
  id: string,
): Promise<CaseDetailObservable[]> {
  const numeric = id.replace(/^#/, '')
  const page = await api
    .get(`cases/${numeric}/observables`)
    .json<Page<ObservablePublic>>()
  return toCaseDetailObservables(page.items)
}

/** Audit activity + comments, merged into the Timeline panel's event stream. */
async function fetchCaseTimeline(
  id: string,
): Promise<CaseDetailTimelineEvent[]> {
  const numeric = id.replace(/^#/, '')
  const orgId = getActiveOrgId()
  const [activity, comments, members] = await Promise.all([
    api.get(`cases/${numeric}/activity`).json<Page<AuditPublic>>(),
    api.get(`cases/${numeric}/comments`).json<Page<CommentPublic>>(),
    orgId
      ? api.get(`organisations/${orgId}/members`).json<MemberPublic[]>()
      : Promise.resolve([]),
  ])
  return toCaseDetailTimeline(
    activity.items,
    comments.items,
    Number(numeric),
    members,
  )
}

// --- query options ---------------------------------------------------------

export const casesQueryOptions = (
  filters: CaseListFilters = DEFAULT_CASE_FILTERS,
) =>
  queryOptions({
    queryKey: caseKeys.list(filters),
    queryFn: () => fetchCases(filters),
    // Keep the prior page on screen while the next filter/page request is in
    // flight, so the table doesn't flash empty on every change.
    placeholderData: keepPreviousData,
  })

export const caseFacetsQueryOptions = () =>
  queryOptions({
    queryKey: [...caseKeys.all, 'facets'] as const,
    queryFn: fetchCaseFacets,
  })

export const caseQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.detail(id),
    queryFn: () => fetchCase(id),
  })

export const caseDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.fullDetail(id),
    queryFn: () => fetchCaseDetail(id),
  })

export const caseCountsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.counts(id),
    queryFn: () => fetchCaseCounts(id),
  })

export const caseTasksQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.tasks(id),
    queryFn: () => fetchCaseTasks(id),
  })

export const caseTaskLogsQueryOptions = (id: string, taskId: number) =>
  queryOptions({
    queryKey: caseKeys.taskLogs(id, taskId),
    queryFn: () => fetchCaseTaskLogs(id, taskId),
  })

export const caseObservablesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.observables(id),
    queryFn: () => fetchCaseObservables(id),
  })

export const caseTimelineQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.timeline(id),
    queryFn: () => fetchCaseTimeline(id),
  })

export const caseSimilarQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.similar(id),
    queryFn: () => fetchCaseSimilarCases(id),
  })

export const caseCustomFieldValuesQueryOptions = (id: string) =>
  queryOptions({
    queryKey: caseKeys.customFieldValues(id),
    queryFn: () => fetchCaseCustomFieldValues(id),
  })

export const caseCommentsQueryOptions = (caseId: string, sortOrder = 'desc') =>
  queryOptions({
    queryKey: caseKeys.comments(caseId, sortOrder),
    queryFn: () => fetchCaseComments(caseId, sortOrder),
  })

// --- Case attachments -------------------------------------------------------

async function fetchCaseAttachments(
  caseId: string,
): Promise<CaseDetailAttachment[]> {
  const numeric = caseId.replace(/^#/, '')
  const page = await api
    .get(`cases/${numeric}/attachments`)
    .json<Page<AttachmentPublic>>()
  return page.items.map(toCaseDetailAttachment)
}

export async function uploadCaseAttachment(
  caseId: string,
  file: File,
): Promise<AttachmentPublic> {
  const numeric = caseId.replace(/^#/, '')
  const body = new FormData()
  body.append('file', file)
  if (file.name) body.append('name', file.name)
  return api
    .post(`cases/${numeric}/attachments`, { body })
    .json<AttachmentPublic>()
}

export function caseAttachmentDownloadUrl(
  caseId: string,
  linkId: number,
): string {
  const numeric = caseId.replace(/^#/, '')
  return `${API_BASE}/cases/${numeric}/attachments/${linkId}/file`
}

export async function deleteCaseAttachment(
  caseId: string,
  linkId: number,
): Promise<void> {
  const numeric = caseId.replace(/^#/, '')
  await api.delete(`cases/${numeric}/attachments/${linkId}`)
}

export async function downloadCaseAttachment(
  caseId: string,
  linkId: number,
  filename: string,
): Promise<void> {
  const numeric = caseId.replace(/^#/, '')
  const blob = await api
    .get(`cases/${numeric}/attachments/${linkId}/file`)
    .blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(objectUrl)
  a.remove()
}

export const caseAttachmentsQueryOptions = (caseId: string) =>
  queryOptions({
    queryKey: caseKeys.attachments(caseId),
    queryFn: () => fetchCaseAttachments(caseId),
  })
