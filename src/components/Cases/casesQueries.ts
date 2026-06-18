/**
 * Data-fetching layer for Cases — follows the project's TanStack Query pattern
 * (see src/lib/api/README.md and alertsQueries.ts for the reference):
 *
 *   1. a query-key factory  (`caseKeys`)
 *   2. fetchers + DTO mapping (`fetchCases`, `toCase`)
 *   3. `queryOptions` units (`casesQueryOptions`, `caseQueryOptions`)
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { CaseStatus, Severity, Tlp } from '#/lib/domain'
import type {
  AuditPublic,
  CasePublic,
  CommentPublic,
  ObservablePublic,
  TaskPublic,
} from './caseDetails'
import { toCaseDetail } from './caseDetails'
import type { CaseDetail } from './caseDetails.types'
import type { Case } from './cases.types'

export type CaseListFilters = {
  /** Backend `status_filter` (Open | Resolved | Duplicated). */
  status?: string
  /** Backend `severity` (1–4). */
  severity?: number
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
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
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

async function fetchCases(filters: CaseListFilters): Promise<Case[]> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status_filter', filters.status)
  if (filters.severity) params.set('severity', String(filters.severity))
  const page = await api
    .get('cases/', { searchParams: params })
    .json<Page<CasePublic>>()
  return page.items.map(toCase)
}

async function fetchCase(id: string): Promise<Case> {
  const numeric = id.replace(/^#/, '')
  const c = await api.get(`cases/${numeric}`).json<CasePublic>()
  return toCase(c)
}

export async function fetchCaseDetail(id: string): Promise<CaseDetail> {
  const numeric = id.replace(/^#/, '')
  const [caseItem, tasks, observables, comments, activity] = await Promise.all([
    api.get(`cases/${numeric}`).json<CasePublic>(),
    api.get(`cases/${numeric}/tasks`).json<Page<TaskPublic>>(),
    api.get(`cases/${numeric}/observables`).json<Page<ObservablePublic>>(),
    api.get(`cases/${numeric}/comments`).json<Page<CommentPublic>>(),
    api.get(`cases/${numeric}/activity`).json<Page<AuditPublic>>(),
  ])

  return toCaseDetail({
    case: caseItem,
    tasks: tasks.items,
    observables: observables.items,
    comments: comments.items,
    activity: activity.items,
  })
}

// --- query options ---------------------------------------------------------

export const casesQueryOptions = (filters: CaseListFilters = {}) =>
  queryOptions({
    queryKey: caseKeys.list(filters),
    queryFn: () => fetchCases(filters),
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
