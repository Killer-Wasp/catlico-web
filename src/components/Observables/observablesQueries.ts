import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type { Tlp } from '#/lib/domain'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from './observables.types'
import type {
  PluginRunPublic,
  QueueObservablePluginRunRequest,
} from '#/components/Plugins/plugins.types'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type ObservablePublic = {
  id: string
  case_id: number | null
  alert_id: number | null
  observable_type: string
  data: string
  message: string
  tlp: number
  ioc: boolean
  sighted: boolean
  ignore_similarity: boolean
  organisation_id: string
  created_at: string
  updated_at: string | null
}

/** Column the observable list is sorted by, server-side. */
export type ObservableSort = 'value' | 'added'

export type ObservableListFilters = {
  clauses?: FilterClause[]
  sort?: ObservableSort | ''
  order?: 'asc' | 'desc'
  skip?: number
  limit?: number
}

export type ObservablesResult = { observables: Observable[]; total: number }

/** Filterable values across the org's observables, for the filter dropdowns. */
export type ObservableFacets = { sources: string[] }

export const DEFAULT_OBSERVABLE_FILTERS: ObservableListFilters = {
  sort: '',
  order: 'desc',
  skip: 0,
  limit: 10,
}

export const observableKeys = {
  all: ['observables'] as const,
  lists: () => [...observableKeys.all, 'list'] as const,
  list: (filters: ObservableListFilters = DEFAULT_OBSERVABLE_FILTERS) =>
    [...observableKeys.lists(), filters] as const,
}

const TYPE_MAP: Record<string, ObservableType> = {
  domain: 'domain',
  url: 'url',
  mail: 'mail',
  email: 'mail',
  ip: 'ip',
  ipv4: 'ip',
  ipv6: 'ip',
  hash: 'hash',
  file: 'file',
  filename: 'file',
  other: 'other',
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function toObservable(dto: ObservablePublic): Observable {
  const flags: ObservableFlag[] = []
  if (dto.ioc) flags.push('ioc')
  if (dto.sighted) flags.push('sighted')

  return {
    id: dto.id,
    type: TYPE_MAP[dto.observable_type.toLowerCase()] ?? 'other',
    value: dto.data,
    flags,
    tlp: clamp(dto.tlp, 0, 3) as Tlp,
    source:
      dto.case_id != null
        ? `#${dto.case_id}`
        : dto.alert_id != null
          ? `AL-${dto.alert_id}`
          : 'feed',
    ...(dto.message.trim()
      ? { analysis: { analyzer: 'Note', verdict: dto.message } }
      : {}),
    added: compactTime(dto.created_at),
    addedAt: dto.created_at,
  }
}

export async function fetchObservables(
  filters: ObservableListFilters = DEFAULT_OBSERVABLE_FILTERS,
): Promise<ObservablesResult> {
  const params = new URLSearchParams()
  appendClauses(params, filters.clauses)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const page = await api
    .get('observables/', { searchParams: params })
    .json<Page<ObservablePublic>>()
  return { observables: page.items.map(toObservable), total: page.total }
}

export const observablesQueryOptions = (
  filters: ObservableListFilters = DEFAULT_OBSERVABLE_FILTERS,
) =>
  queryOptions({
    queryKey: observableKeys.list(filters),
    queryFn: () => fetchObservables(filters),
    placeholderData: keepPreviousData,
  })

async function fetchObservableFacets(): Promise<ObservableFacets> {
  return api.get('observables/filters').json<ObservableFacets>()
}

export const observableFacetsQueryOptions = () =>
  queryOptions({
    queryKey: [...observableKeys.all, 'facets'] as const,
    queryFn: fetchObservableFacets,
  })

export async function updateObservableFlags(
  id: string,
  flags: { ioc: boolean; sighted: boolean },
): Promise<void> {
  await api.patch(`observables/${id}`, {
    json: flags,
  })
}

/**
 * Queue one plugin run for one observable. `force: true` bypasses the dedup
 * no-op so a genuine re-run dispatches. Returns the server's synthetic
 * queued-run view.
 */
export async function queueObservablePluginRun(
  observableId: string,
  body: QueueObservablePluginRunRequest,
): Promise<PluginRunPublic> {
  return api
    .post(`observables/${observableId}/plugin-runs`, { json: body })
    .json<PluginRunPublic>()
}
