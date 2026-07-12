/**
 * Data-fetching for the SOC Overview dashboard. One query hits `GET /overview`
 * (see app/api/v1/routes/overview.py) and maps the aggregate DTO to the shapes
 * the page renders. Follows the project's queryOptions pattern (see
 * `alertsQueries.ts`).
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { Severity, Tlp } from '#/lib/domain'

// --- API DTOs (mirror app/models/overview.py) ------------------------------

type TrendPointDTO = { label: string; count: number }

type KpiStatsDTO = {
  open_cases: number
  open_cases_delta: number
  new_alerts_24h: number
  new_alerts_delta_pct: number
  sla_breaches: number
  sla_breaches_critical: number
  sla_breaches_high: number
  mttr_hours_7d: number | null
  mttr_delta_hours: number | null
}

type TriageAlertDTO = {
  id: number
  title: string
  severity: number
  tlp: number
  source: string
  tags: string[]
  date: string
  breach: boolean
}

type WorkloadRowDTO = { name: string; email: string | null; open_tasks: number }

type IngestionPointDTO = { hour: string; ingested: number; promoted: number }

type ObservableRowDTO = {
  id: string
  type: string
  value: string
  ioc: boolean
  date: string
}

type CaseTrendPointDTO = { date: string; opened: number; resolved: number }

type SlaComplianceDTO = { met: number; breached: number; pct: number | null }

export type OverviewDTO = {
  generated_at: string
  stats: KpiStatsDTO
  alerts_by_severity: TrendPointDTO[]
  open_alerts_total: number
  triage_queue: TriageAlertDTO[]
  case_pipeline: TrendPointDTO[]
  analyst_workload: WorkloadRowDTO[]
  ingestion_24h: IngestionPointDTO[]
  latest_observables: ObservableRowDTO[]
  trend_days: number
  case_trend: CaseTrendPointDTO[]
  resolution_breakdown: TrendPointDTO[]
  alerts_by_source: TrendPointDTO[]
  iocs_tracked: number
  cases_by_severity: TrendPointDTO[]
  sla_compliance: SlaComplianceDTO
}

// --- UI models -------------------------------------------------------------

export type OverviewStats = {
  openCases: number
  openCasesDelta: number
  newAlerts24h: number
  newAlertsDeltaPct: number
  slaBreaches: number
  slaBreachesCritical: number
  slaBreachesHigh: number
  mttrHours7d: number | null
  mttrDeltaHours: number | null
}

export type SeverityBreakdown = { label: string; count: number }

export type TriageAlert = {
  id: string
  title: string
  sev: Severity
  tlp: Tlp
  source: string
  tags: string[]
  date: string
  breach: boolean
}

export type WorkloadRow = { name: string; email: string | null; openTasks: number }

export type IngestionPoint = { hour: string; ingested: number; promoted: number }

export type LatestObservable = {
  id: string
  type: string
  value: string
  ioc: boolean
  date: string
}

export type CaseTrendPoint = { date: string; opened: number; resolved: number }

export type SlaCompliance = {
  met: number
  breached: number
  pct: number | null
}

export type Overview = {
  generatedAt: string
  stats: OverviewStats
  alertsBySeverity: SeverityBreakdown[]
  openAlertsTotal: number
  triageQueue: TriageAlert[]
  casePipeline: SeverityBreakdown[]
  analystWorkload: WorkloadRow[]
  ingestion24h: IngestionPoint[]
  latestObservables: LatestObservable[]
  trendDays: number
  caseTrend: CaseTrendPoint[]
  resolutionBreakdown: SeverityBreakdown[]
  alertsBySource: SeverityBreakdown[]
  iocsTracked: number
  casesBySeverity: SeverityBreakdown[]
  slaCompliance: SlaCompliance
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

export function toOverview(dto: OverviewDTO): Overview {
  return {
    generatedAt: dto.generated_at,
    stats: {
      openCases: dto.stats.open_cases,
      openCasesDelta: dto.stats.open_cases_delta,
      newAlerts24h: dto.stats.new_alerts_24h,
      newAlertsDeltaPct: dto.stats.new_alerts_delta_pct,
      slaBreaches: dto.stats.sla_breaches,
      slaBreachesCritical: dto.stats.sla_breaches_critical,
      slaBreachesHigh: dto.stats.sla_breaches_high,
      mttrHours7d: dto.stats.mttr_hours_7d,
      mttrDeltaHours: dto.stats.mttr_delta_hours,
    },
    alertsBySeverity: dto.alerts_by_severity,
    openAlertsTotal: dto.open_alerts_total,
    triageQueue: dto.triage_queue.map((a) => ({
      id: `AL-${a.id}`,
      title: a.title,
      sev: clamp(a.severity, 1, 4) as Severity,
      tlp: clamp(a.tlp, 0, 3) as Tlp,
      source: a.source,
      tags: a.tags,
      date: a.date,
      breach: a.breach,
    })),
    casePipeline: dto.case_pipeline,
    analystWorkload: dto.analyst_workload.map((w) => ({
      name: w.name,
      email: w.email,
      openTasks: w.open_tasks,
    })),
    ingestion24h: dto.ingestion_24h,
    latestObservables: dto.latest_observables,
    trendDays: dto.trend_days,
    caseTrend: dto.case_trend,
    resolutionBreakdown: dto.resolution_breakdown,
    alertsBySource: dto.alerts_by_source,
    iocsTracked: dto.iocs_tracked,
    casesBySeverity: dto.cases_by_severity,
    slaCompliance: dto.sla_compliance,
  }
}

async function fetchOverview(trendDays: number): Promise<Overview> {
  const dto = await api
    .get('overview', { searchParams: { trend_days: trendDays } })
    .json<OverviewDTO>()
  return toOverview(dto)
}

export const overviewKeys = {
  all: ['overview'] as const,
  range: (trendDays: number) => [...overviewKeys.all, { trendDays }] as const,
}

export const overviewQueryOptions = (trendDays = 14) =>
  queryOptions({
    queryKey: overviewKeys.range(trendDays),
    queryFn: () => fetchOverview(trendDays),
    // SOC wallboard: keep the snapshot live without a manual Refresh.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
