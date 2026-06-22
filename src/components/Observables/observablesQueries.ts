import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { Tlp } from '#/lib/domain'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from './observables.types'

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

export const observableKeys = {
  all: ['observables'] as const,
  list: () => [...observableKeys.all, 'list'] as const,
  enrichments: (id: string) =>
    [...observableKeys.all, 'enrichments', id] as const,
}

export type EnrichmentVerdict = 'info' | 'safe' | 'suspicious' | 'malicious'

export type EnrichmentJob = {
  id: string
  observable_id: string
  connector_name: string
  connector_version: string
  status: string
  verdict: EnrichmentVerdict | null
  error: string | null
  from_cache: boolean
  queued_at: string
  ended_at: string | null
}

export type ReportTag = {
  connector_name: string
  namespace: string
  predicate: string
  value: string
  level: EnrichmentVerdict
}

export type EnrichmentOverview = {
  jobs: EnrichmentJob[]
  tags: ReportTag[]
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
  }
}

export async function fetchObservables(): Promise<Observable[]> {
  const page = await api.get('observables/').json<Page<ObservablePublic>>()
  return page.items.map(toObservable)
}

export const observablesQueryOptions = () =>
  queryOptions({
    queryKey: observableKeys.list(),
    queryFn: fetchObservables,
  })

export async function fetchObservableEnrichments(
  id: string,
): Promise<EnrichmentOverview> {
  return api.get(`observables/${id}/enrichments`).json<EnrichmentOverview>()
}

export const observableEnrichmentsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: observableKeys.enrichments(id),
    queryFn: () => fetchObservableEnrichments(id),
  })
