import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type {
  ConnectorJob,
  ConnectorJobDetail,
  ConnectorJobStatus,
  ConnectorJobTab,
  ConnectorJobVerdict,
} from './connectorJobs.types'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

/** The org-wide enrichment-job row returned by `GET /enrichment-jobs`. */
export type EnrichmentJobRow = {
  id: string
  observable_id: string
  connector_name: string
  connector_display_name: string
  connector_version: string
  data_type: string
  data: string
  status: string
  verdict: string | null
  error: string | null
  from_cache: boolean
  attempts: number
  queued_at: string
  started_at: string | null
  ended_at: string | null
}

type ReportTagDto = {
  connector_name: string
  namespace: string
  predicate: string
  value: string
  level: string
}

export type EnrichmentJobDetailDto = EnrichmentJobRow & {
  tlp: number
  pap: number
  report: Record<string, unknown> | null
  tags: ReportTagDto[]
  created_by: string
}

// Backend job statuses map onto the four queue tabs. A leased job is "running";
// a cancelled job is only ever transient (cancel deletes the row) so it folds
// into failure if one is ever observed mid-flight.
const STATUS_MAP: Record<string, ConnectorJobStatus> = {
  queued: 'queued',
  leased: 'running',
  success: 'success',
  failure: 'failure',
  cancelled: 'failure',
}

const VERDICT_MAP: Record<string, ConnectorJobVerdict> = {
  info: 'INFO',
  safe: 'CLEAN',
  suspicious: 'SUSPICIOUS',
  malicious: 'MALICIOUS',
}

export const connectorJobTabs: { value: ConnectorJobTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
]

function toStatus(value: string): ConnectorJobStatus {
  return STATUS_MAP[value] ?? 'failure'
}

function toVerdict(value: string | null): ConnectorJobVerdict | undefined {
  return value ? VERDICT_MAP[value] : undefined
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** Wall-clock duration between lease and completion, e.g. `0.8s`. */
function duration(started: string | null, ended: string | null): string | undefined {
  if (!started || !ended) return undefined
  const ms = new Date(ended).getTime() - new Date(started).getTime()
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return `${(ms / 1000).toFixed(1)}s`
}

function shortRef(id: string): string {
  return `J-${id.slice(0, 6)}`
}

export function toConnectorJob(dto: EnrichmentJobRow): ConnectorJob {
  const status = toStatus(dto.status)
  return {
    id: dto.id,
    ref: shortRef(dto.id),
    observableId: dto.observable_id,
    observableType: dto.data_type,
    observable: dto.data,
    plugin: dto.connector_display_name,
    status,
    cached: dto.from_cache || undefined,
    verdict: toVerdict(dto.verdict),
    // A finished job's start time is when it was leased; the queue shows when it
    // ran, so fall back to the queued time only while it's still waiting.
    started:
      dto.started_at != null
        ? clockTime(dto.started_at)
        : status === 'queued'
          ? undefined
          : clockTime(dto.queued_at),
    duration: duration(dto.started_at, dto.ended_at),
  }
}

function toDetail(dto: EnrichmentJobDetailDto): ConnectorJobDetail {
  return {
    id: dto.id,
    observableType: dto.data_type,
    observable: dto.data,
    plugin: dto.connector_display_name,
    version: dto.connector_version,
    status: toStatus(dto.status),
    verdict: toVerdict(dto.verdict),
    cached: dto.from_cache,
    error: dto.error ?? undefined,
    attempts: dto.attempts,
    tlp: dto.tlp,
    queued: clockTime(dto.queued_at),
    started: dto.started_at ? clockTime(dto.started_at) : undefined,
    ended: dto.ended_at ? clockTime(dto.ended_at) : undefined,
    duration: duration(dto.started_at, dto.ended_at),
    tags: dto.tags.map((tag) => ({
      connector: tag.connector_name,
      namespace: tag.namespace,
      predicate: tag.predicate,
      value: tag.value,
      level: VERDICT_MAP[tag.level] ?? 'INFO',
    })),
    report: dto.report,
  }
}

const PAGE_LIMIT = 200

export const analyzerJobKeys = {
  all: ['analyzer-jobs'] as const,
  list: () => [...analyzerJobKeys.all, 'list'] as const,
  detail: (id: string) => [...analyzerJobKeys.all, 'detail', id] as const,
}

export async function fetchAnalyzerJobs(): Promise<ConnectorJob[]> {
  const page = await api
    .get(`enrichment-jobs?limit=${PAGE_LIMIT}`)
    .json<Page<EnrichmentJobRow>>()
  return page.items.map(toConnectorJob)
}

export const analyzerJobsQueryOptions = () =>
  queryOptions({
    queryKey: analyzerJobKeys.list(),
    queryFn: fetchAnalyzerJobs,
    // Keep the live queue reasonably fresh without polling the org queue hard
    // from the app-wide navbar badge.
    refetchInterval: 30_000,
  })

export async function fetchAnalyzerJobDetail(
  id: string,
): Promise<ConnectorJobDetail> {
  const dto = await api.get(`enrichment-jobs/${id}`).json<EnrichmentJobDetailDto>()
  return toDetail(dto)
}

export const analyzerJobDetailQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: analyzerJobKeys.detail(id ?? ''),
    queryFn: () => fetchAnalyzerJobDetail(id as string),
    enabled: id !== null,
  })

export async function cancelAnalyzerJob(id: string): Promise<void> {
  await api.post(`enrichment-jobs/${id}/cancel`)
}

export async function retryFailedAnalyzerJobs(): Promise<number> {
  const result = await api
    .post('enrichment-jobs/retry-failed')
    .json<{ requeued: number }>()
  return result.requeued
}

export async function clearFinishedAnalyzerJobs(): Promise<number> {
  const result = await api
    .post('enrichment-jobs/clear-finished')
    .json<{ cleared: number }>()
  return result.cleared
}

export function filterConnectorJobsByTab(
  jobs: ConnectorJob[],
  tab: ConnectorJobTab,
) {
  if (tab === 'all') return jobs
  return jobs.filter((job) => job.status === tab)
}

export function countConnectorJobsByTab(jobs: ConnectorJob[]) {
  return connectorJobTabs.reduce(
    (counts, tab) => ({
      ...counts,
      [tab.value]: filterConnectorJobsByTab(jobs, tab.value).length,
    }),
    {} as Record<ConnectorJobTab, number>,
  )
}
