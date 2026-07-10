// Global search: types, fetcher, query options, and hit -> route mapping.
// Backend: GET /api/v1/search.
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

export type SearchEntityType = 'case' | 'alert' | 'observable' | 'task' | 'comment'

export const SEARCH_TYPES: SearchEntityType[] = [
  'case',
  'alert',
  'observable',
  'task',
  'comment',
]

export type CaseHit = {
  id: number
  title: string
  snippet: string
  status: string
  severity: number
  updated_at: string | null
  created_at: string
}
export type AlertHit = {
  id: number
  title: string
  snippet: string
  status: string
  severity: number
}
export type ObservableHit = {
  id: string
  observable_type: string
  data: string
  case_id: number | null
  alert_id: number | null
  ioc: boolean
  message: string
  verdict: string | null
}
export type ObservableGroupHit = {
  observable_type: string
  data: string
  occurrences: number
}
export type TaskHit = {
  case_id: number
  id: number
  public_id: string
  title: string
  status: string
}
export type CommentHit = {
  id: string
  entity_type: 'case' | 'alert'
  entity_id: string
  snippet: string
  author_name: string
  created_at: string
}

export type SearchResponse = {
  counts: Record<SearchEntityType, number>
  results: {
    case: CaseHit[]
    alert: AlertHit[]
    observable: ObservableHit[]
    observable_groups: ObservableGroupHit[]
    task: TaskHit[]
    comment: CommentHit[]
  }
}

export type SearchOptions = {
  types?: SearchEntityType[]
  limit?: number
  offset?: number
  groupObservables?: boolean
}

export async function fetchSearch(
  q: string,
  opts: SearchOptions = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q })
  for (const t of opts.types ?? []) params.append('types', t)
  if (opts.limit !== undefined) params.set('limit', String(opts.limit))
  if (opts.offset !== undefined) params.set('offset', String(opts.offset))
  if (opts.groupObservables) params.set('group_observables', 'true')
  return api.get('search', { searchParams: params }).json<SearchResponse>()
}

/** Shared by the palette and the results page. Disabled under 2 chars —
 * mirrors the backend's no-op threshold, so we never fire those requests. */
export function searchQueryOptions(q: string, opts: SearchOptions = {}) {
  return queryOptions({
    queryKey: ['search', q, opts],
    queryFn: () => fetchSearch(q, opts),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

type RouteTarget =
  | { to: '/cases/$caseId/$tab'; params: { caseId: string; tab: string } }
  | { to: '/alerts/$alertId'; params: { alertId: string } }

/** Where clicking/entering a hit navigates. No scroll-to-anchor in v1 —
 * we land on the parent's relevant tab. */
export function hitRoute(
  type: SearchEntityType,
  hit: {
    id?: number | string
    case_id?: number | null
    alert_id?: number | null
    entity_type?: 'case' | 'alert'
    entity_id?: string
  },
): RouteTarget {
  const caseTab = (caseId: number | string, tab: string): RouteTarget => ({
    to: '/cases/$caseId/$tab',
    params: { caseId: String(caseId), tab },
  })
  const alertPage = (alertId: number | string): RouteTarget => ({
    to: '/alerts/$alertId',
    params: { alertId: String(alertId) },
  })

  switch (type) {
    case 'case':
      return caseTab(hit.id!, 'details')
    case 'alert':
      return alertPage(hit.id!)
    case 'observable':
      return hit.case_id != null ? caseTab(hit.case_id, 'observables') : alertPage(hit.alert_id!)
    case 'task':
      return caseTab(hit.case_id!, 'tasks')
    case 'comment':
      return hit.entity_type === 'case'
        ? caseTab(hit.entity_id!, 'comments')
        : alertPage(hit.entity_id!)
  }
}
