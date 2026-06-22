/**
 * Data-fetching layer for Cases — follows the project's TanStack Query pattern
 * (see src/lib/api/README.md and alertsQueries.ts for the reference):
 *
 *   1. a query-key factory  (`caseKeys`)
 *   2. fetchers + DTO mapping (`fetchCases`, `toCase`)
 *   3. `queryOptions` units (`casesQueryOptions`, `caseQueryOptions`)
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'
import type { CaseStatus, Severity, Tlp } from '#/lib/domain'
import type { MemberPublic } from './caseUsers'
import type {
  AuditPublic,
  CasePublic,
  CommentPublic,
  ObservablePublic,
  TaskPublic,
  WorkLogPublic,
} from './caseDetails'
import { toCaseDetail, toCaseDetailTaskLog } from './caseDetails'
import type { CaseDetail } from './caseDetails.types'
import type { Case } from './cases.types'

/** Column the list is sorted by, server-side. */
export type CaseSort = 'id' | 'created' | 'updated'

/**
 * The complete query the cases list sends to the backend: filters (every field
 * is OR-within / AND-across), the sort, and the page window. Empty/omitted
 * fields impose no constraint. This is the single source of truth for both the
 * query key and the request, so two calls with the same filters share a cache
 * entry.
 */
export type CaseListFilters = {
  /** Backend `status_filter` (Open | Resolved | Duplicated). */
  status?: string[]
  /** Backend `severity` (1–4). */
  severity?: number[]
  /** Assignee emails, plus the literal `Unassigned` for unassigned cases. */
  assignee?: string[]
  /** Tag strings; a case matches if it carries any. */
  tag?: string[]
  /** Case-insensitive title substrings. */
  title?: string[]
  /** Case-number substrings (the leading `#` is tolerated). */
  case?: string[]
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
    status: status.id,
    statusName: status.name,
    title: c.title,
    assignee: c.assignee_email ?? 'Unassigned',
    tags: c.tags,
    tasksDone: activeTasks.filter((t) => t.status === 'Completed').length,
    tasksTotal: activeTasks.length,
    created: relativeStamp(c.created_at),
    updated: relativeStamp(c.updated_at ?? c.created_at),
    ...(c.duplicate_of_case_id != null
      ? { duplicateOf: `#${c.duplicate_of_case_id}` }
      : {}),
  }
}

// --- fetchers --------------------------------------------------------------

// Append each value of a multi-value filter as a repeated query param
// (`?tag=a&tag=b`), matching FastAPI's `list[...]` query parsing.
function appendAll(params: URLSearchParams, key: string, values?: string[]) {
  for (const v of values ?? []) params.append(key, v)
}

async function fetchCases(filters: CaseListFilters): Promise<CasesResult> {
  const params = new URLSearchParams()
  appendAll(params, 'status_filter', filters.status)
  appendAll(params, 'severity', filters.severity?.map(String))
  appendAll(params, 'assignee', filters.assignee)
  appendAll(params, 'tag', filters.tag)
  appendAll(params, 'title', filters.title)
  appendAll(params, 'case_q', filters.case)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const page = await api
    .get('cases/', { searchParams: params })
    .json<Page<CasePublic>>()
  return { cases: page.items.map(toCase), total: page.total }
}

/** Distinct assignee/tag values across the org's cases, for the filter dropdowns. */
export type CaseFacets = {
  assignees: string[]
  unassigned: boolean
  tags: string[]
}

async function fetchCaseFacets(): Promise<CaseFacets> {
  return api.get('cases/filters').json<CaseFacets>()
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

export async function updateTaskDetailFields({
  taskId,
  description,
  status,
}: {
  taskId: string
  description?: string
  status?: CaseDetail['tasks'][number]['status']
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
  await api.patch(`tasks/${taskId}`, { json })
}

export async function createTaskWorkLog({
  taskId,
  bodyMarkdown,
  files = [],
}: {
  taskId: string
  bodyMarkdown: string
  files?: File[]
}) {
  const log = await api
    .post(`tasks/${taskId}/work-logs`, {
      json: { message: bodyMarkdown },
    })
    .json<WorkLogPublic>()

  for (const file of files) {
    const body = new FormData()
    body.append('file', file)
    await api.post(`tasks/${taskId}/work-logs/${log.id}/attachments`, { body })
  }

  return toCaseDetailTaskLog(log)
}

export async function updateTaskWorkLog({
  taskId,
  logId,
  bodyMarkdown,
}: {
  taskId: string
  logId: string
  bodyMarkdown: string
}) {
  const log = await api
    .patch(`tasks/${taskId}/work-logs/${logId}`, {
      json: { message: bodyMarkdown },
    })
    .json<WorkLogPublic>()

  return toCaseDetailTaskLog(log)
}

async function fetchCase(id: string): Promise<Case> {
  const numeric = id.replace(/^#/, '')
  const c = await api.get(`cases/${numeric}`).json<CasePublic>()
  return toCase(c)
}

export async function fetchCaseDetail(id: string): Promise<CaseDetail> {
  const numeric = id.replace(/^#/, '')
  const orgId = getActiveOrgId()
  const [caseItem, tasks, observables, comments, activity, members] =
    await Promise.all([
      api.get(`cases/${numeric}`).json<CasePublic>(),
      api.get(`cases/${numeric}/tasks`).json<Page<TaskPublic>>(),
      api.get(`cases/${numeric}/observables`).json<Page<ObservablePublic>>(),
      api.get(`cases/${numeric}/comments`).json<Page<CommentPublic>>(),
      api.get(`cases/${numeric}/activity`).json<Page<AuditPublic>>(),
      orgId
        ? api.get(`organisations/${orgId}/members`).json<MemberPublic[]>()
        : Promise.resolve([]),
    ])

  return toCaseDetail({
    case: caseItem,
    tasks: tasks.items,
    observables: observables.items,
    comments: comments.items,
    activity: activity.items,
    members,
  })
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
