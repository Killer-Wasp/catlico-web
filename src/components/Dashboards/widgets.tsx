/**
 * Widget catalog for the customisable Dashboards page. Every widget renders
 * purely from the shared `/overview` metrics snapshot (see overviewQueries.ts),
 * so a dashboard is just an ordered list of widget descriptors — no per-widget
 * fetching. `WIDGET_CATALOG` drives the "add widget" menu; `renderWidget` maps a
 * descriptor's `type` to its content.
 */
import type { Overview } from '#/components/Overview/overviewQueries'
import { RelativeTime } from '#/components/Time/RelativeTime'
import {
  AreaChart,
  BarChart,
  BarsList,
  DonutChart,
  LineChart,
} from '@mantine/charts'
import { Badge, Box, Group, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'
import classes from '#/components/pages/dashboards/DashboardsPage.module.css'

export type WidgetSize = 'sm' | 'md' | 'lg'

type WidgetKind = 'kpi' | 'panel'

type CatalogEntry = {
  title: string
  category: 'KPI' | 'Cases' | 'Alerts' | 'Team' | 'SLA'
  kind: WidgetKind
  defaultSize: WidgetSize
}

const SEV_DONUT: Record<string, string> = {
  critical: 'red.6',
  high: 'orange.6',
  medium: 'yellow.6',
  low: 'blue.6',
}
const PIPELINE_COLOR: Record<string, string> = {
  New: 'blue.6',
  'In progress': 'orange.6',
  Open: 'blue.6',
  Resolved: 'green.6',
  Duplicated: 'gray.5',
}
const RESOLUTION_COLOR: Record<string, string> = {
  'True positive': 'red.6',
  'False positive': 'gray.5',
  Indeterminate: 'yellow.6',
  Other: 'grape.5',
  Duplicated: 'blue.5',
  Unset: 'gray.4',
}
const SOURCE_PALETTE = [
  'indigo.6',
  'teal.6',
  'grape.6',
  'cyan.6',
  'orange.6',
  'lime.6',
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const cssColor = (c: string) => `var(--mantine-color-${c.replace('.', '-')})`

// --- shared primitives -----------------------------------------------------

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box className={classes.card}>
      <Text fw={700} fz={15} mb="sm">
        {title}
      </Text>
      {children}
    </Box>
  )
}

function Kpi({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  accent?: boolean
}) {
  return (
    <Box className={`${classes.card} ${accent ? classes.kpiAccent : ''}`}>
      <Text className={classes.kpiLabel}>{label}</Text>
      <Text className={classes.kpiValue} my={6}>
        {value}
        {unit && <span className={classes.kpiUnit}>{unit}</span>}
      </Text>
      {sub}
    </Box>
  )
}

/** Signed change; higher is worse (up=red, down=green). */
function Delta({
  value,
  format,
  label,
}: {
  value: number | null
  format: (n: number) => string
  label: string
}) {
  if (value == null)
    return (
      <Text fz={12} c="dimmed">
        — {label}
      </Text>
    )
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '·'
  const color =
    value > 0 ? 'var(--sev-critical)' : value < 0 ? 'var(--ok)' : undefined
  return (
    <Text fz={12} c={color ? undefined : 'dimmed'} style={{ color }}>
      {arrow} {format(Math.abs(value))} {label}
    </Text>
  )
}

type DonutDatum = { name: string; value: number; color: string }

function Donut({
  data,
  centerLabel,
  emptyText,
}: {
  data: DonutDatum[]
  centerLabel: string
  emptyText: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0)
    return (
      <Text c="dimmed" fz={13} py="sm">
        {emptyText}
      </Text>
    )
  return (
    <Group justify="space-between" wrap="nowrap" gap="lg">
      <DonutChart
        data={data}
        size={148}
        thickness={20}
        paddingAngle={2}
        withTooltip
        tooltipDataSource="segment"
        chartLabel={centerLabel}
        mx="auto"
      />
      <Stack gap={7} miw={116}>
        {data.map((d) => (
          <Group key={d.name} gap={8} justify="space-between" wrap="nowrap">
            <Group gap={7} wrap="nowrap">
              <Box
                w={9}
                h={9}
                style={{ borderRadius: 2, background: cssColor(d.color) }}
              />
              <Text fz={13} c="dimmed">
                {d.name}
              </Text>
            </Group>
            <Text fw={600} ff="monospace" fz={13}>
              {d.value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Group>
  )
}

function ListRows({
  rows,
}: {
  rows: { key: string; left: ReactNode; right: ReactNode }[]
}) {
  if (rows.length === 0)
    return (
      <Text c="dimmed" fz={13}>
        No data.
      </Text>
    )
  return (
    <Box>
      {rows.map((r) => (
        <Box key={r.key} className={classes.listRow}>
          {r.left}
          {r.right}
        </Box>
      ))}
    </Box>
  )
}

// --- catalog ---------------------------------------------------------------

export const WIDGET_CATALOG: Record<string, CatalogEntry> = {
  'kpi.open_cases': { title: 'Open cases', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'kpi.new_alerts': { title: 'New alerts · 24h', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'kpi.sla_breaches': { title: 'SLA breaches', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'kpi.mttr': { title: 'MTTR · 7 days', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'kpi.iocs_tracked': { title: 'IOCs tracked', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'kpi.open_alerts': { title: 'Open alerts', category: 'KPI', kind: 'kpi', defaultSize: 'sm' },
  'chart.cases_by_status': { title: 'Cases by status', category: 'Cases', kind: 'panel', defaultSize: 'md' },
  'chart.cases_by_severity': { title: 'Cases by severity', category: 'Cases', kind: 'panel', defaultSize: 'md' },
  'chart.cases_opened_14d': { title: 'Cases opened', category: 'Cases', kind: 'panel', defaultSize: 'md' },
  'chart.case_trend': { title: 'Case trend', category: 'Cases', kind: 'panel', defaultSize: 'lg' },
  'chart.resolutions': { title: 'Case resolutions', category: 'Cases', kind: 'panel', defaultSize: 'md' },
  'chart.alerts_by_severity': { title: 'Open alerts by severity', category: 'Alerts', kind: 'panel', defaultSize: 'md' },
  'chart.alerts_by_source': { title: 'Alerts by source', category: 'Alerts', kind: 'panel', defaultSize: 'md' },
  'chart.ingestion_24h': { title: 'Alert ingestion · 24h', category: 'Alerts', kind: 'panel', defaultSize: 'lg' },
  'list.latest_observables': { title: 'Latest observables', category: 'Alerts', kind: 'panel', defaultSize: 'md' },
  'chart.analyst_workload': { title: 'Analyst workload', category: 'Team', kind: 'panel', defaultSize: 'md' },
  'chart.sla_compliance': { title: 'SLA compliance · 7d', category: 'SLA', kind: 'panel', defaultSize: 'md' },
}

/** The built-in view shown before a user saves their own dashboard. */
export const DEFAULT_LAYOUT: { type: string; size: WidgetSize }[] = [
  { type: 'kpi.open_cases', size: 'sm' },
  { type: 'kpi.iocs_tracked', size: 'sm' },
  { type: 'kpi.new_alerts', size: 'sm' },
  { type: 'kpi.mttr', size: 'sm' },
  { type: 'chart.cases_by_status', size: 'md' },
  { type: 'chart.cases_by_severity', size: 'md' },
  { type: 'chart.analyst_workload', size: 'md' },
  { type: 'chart.alerts_by_source', size: 'md' },
  { type: 'chart.sla_compliance', size: 'md' },
  { type: 'chart.cases_opened_14d', size: 'md' },
]

// --- renderer --------------------------------------------------------------

export function renderWidget(type: string, data: Overview): ReactNode {
  switch (type) {
    case 'kpi.open_cases':
      return (
        <Kpi
          label="Open cases"
          value={data.stats.openCases}
          sub={<Delta value={data.stats.openCasesDelta} format={(n) => `${n}`} label="vs yesterday" />}
        />
      )
    case 'kpi.new_alerts':
      return (
        <Kpi
          label="New alerts · 24h"
          value={data.stats.newAlerts24h}
          sub={<Delta value={data.stats.newAlertsDeltaPct} format={(n) => `${n}%`} label="vs 7-day avg" />}
        />
      )
    case 'kpi.sla_breaches':
      return (
        <Kpi
          label="SLA breaches"
          accent={data.stats.slaBreaches > 0}
          value={
            <span style={{ color: data.stats.slaBreaches > 0 ? 'var(--sev-critical)' : undefined }}>
              {data.stats.slaBreaches}
            </span>
          }
          sub={
            <Text fz={12} c="dimmed">
              {data.stats.slaBreachesCritical} critical · {data.stats.slaBreachesHigh} high
            </Text>
          }
        />
      )
    case 'kpi.mttr':
      return (
        <Kpi
          label="MTTR · 7 days"
          value={data.stats.mttrHours7d == null ? '—' : data.stats.mttrHours7d}
          unit={data.stats.mttrHours7d == null ? undefined : 'h'}
          sub={<Delta value={data.stats.mttrDeltaHours} format={(n) => `${n}h`} label="vs last week" />}
        />
      )
    case 'kpi.iocs_tracked':
      return (
        <Kpi
          label="IOCs tracked"
          value={data.iocsTracked}
          sub={
            <Text fz={12} c="dimmed">
              flagged observables
            </Text>
          }
        />
      )
    case 'kpi.open_alerts':
      return (
        <Kpi
          label="Open alerts"
          value={data.openAlertsTotal}
          sub={
            <Text fz={12} c="dimmed">
              across all severities
            </Text>
          }
        />
      )

    case 'chart.cases_by_status':
      return (
        <Panel title="Cases by status">
          <Donut
            centerLabel={`${data.casePipeline.reduce((s, d) => s + d.count, 0)} cases`}
            emptyText="No cases yet."
            data={data.casePipeline.map((d) => ({
              name: d.label,
              value: d.count,
              color: PIPELINE_COLOR[d.label] ?? 'gray.5',
            }))}
          />
        </Panel>
      )
    case 'chart.cases_by_severity':
      return (
        <Panel title="Cases by severity">
          <BarsList
            barHeight={24}
            barGap="sm"
            data={data.casesBySeverity.map((d) => ({
              name: cap(d.label),
              value: d.count,
              color: SEV_DONUT[d.label] ?? 'gray.5',
            }))}
          />
        </Panel>
      )
    case 'chart.cases_opened_14d':
      return (
        <Panel title={`Cases opened · ${data.trendDays} days`}>
          <BarChart
            h={190}
            data={data.caseTrend.map((p) => ({
              date: dayjs(p.date).format('DD'),
              opened: p.opened,
            }))}
            dataKey="date"
            series={[{ name: 'opened', color: 'orange.5' }]}
            barProps={{ radius: 3 }}
            gridAxis="y"
            withTooltip
          />
        </Panel>
      )
    case 'chart.case_trend':
      return (
        <Panel title={`Case trend · ${data.trendDays} days`}>
          <LineChart
            h={200}
            data={data.caseTrend.map((p) => ({
              date: dayjs(p.date).format('DD MMM'),
              opened: p.opened,
              resolved: p.resolved,
            }))}
            dataKey="date"
            withDots={false}
            curveType="natural"
            withLegend
            series={[
              { name: 'opened', color: 'blue.5' },
              { name: 'resolved', color: 'teal.5' },
            ]}
            xAxisProps={{ minTickGap: 24 }}
          />
        </Panel>
      )
    case 'chart.resolutions':
      return (
        <Panel title="Case resolutions">
          <Donut
            centerLabel={`${data.resolutionBreakdown.reduce((s, d) => s + d.count, 0)} closed`}
            emptyText="No resolved cases yet."
            data={data.resolutionBreakdown.map((d) => ({
              name: d.label,
              value: d.count,
              color: RESOLUTION_COLOR[d.label] ?? 'gray.5',
            }))}
          />
        </Panel>
      )

    case 'chart.alerts_by_severity':
      return (
        <Panel title="Open alerts by severity">
          <Donut
            centerLabel={`${data.openAlertsTotal} open`}
            emptyText="No open alerts."
            data={data.alertsBySeverity.map((d) => ({
              name: cap(d.label),
              value: d.count,
              color: SEV_DONUT[d.label] ?? 'gray.5',
            }))}
          />
        </Panel>
      )
    case 'chart.alerts_by_source':
      return (
        <Panel title="Alerts by source">
          <BarsList
            barHeight={24}
            barGap="sm"
            data={data.alertsBySource.map((d, i) => ({
              name: d.label,
              value: d.count,
              color: SOURCE_PALETTE[i % SOURCE_PALETTE.length],
            }))}
          />
        </Panel>
      )
    case 'chart.ingestion_24h':
      return (
        <Panel title="Alert ingestion · last 24h">
          <AreaChart
            h={200}
            data={data.ingestion24h.map((p) => ({
              time: dayjs(p.hour).format('HH:mm'),
              ingested: p.ingested,
              promoted: p.promoted,
            }))}
            dataKey="time"
            withDots={false}
            curveType="natural"
            withLegend
            series={[
              { name: 'ingested', color: 'blue.5' },
              { name: 'promoted', color: 'orange.5' },
            ]}
          />
        </Panel>
      )
    case 'list.latest_observables':
      return (
        <Panel title="Latest observables">
          <ListRows
            rows={data.latestObservables.map((o) => ({
              key: o.id,
              left: (
                <Group gap="sm" wrap="nowrap" miw={0}>
                  <Badge variant="default" radius="sm" ff="monospace" tt="none">
                    {o.type}
                  </Badge>
                  <Text ff="monospace" fz={13} truncate maw={190}>
                    {o.value}
                  </Text>
                </Group>
              ),
              right: (
                <Group gap={8} wrap="nowrap">
                  {o.ioc && (
                    <Text ff="monospace" fz={11} c="var(--sev-critical)">
                      IOC
                    </Text>
                  )}
                  <RelativeTime iso={o.date} fz={12} c="dimmed" />
                </Group>
              ),
            }))}
          />
        </Panel>
      )

    case 'chart.analyst_workload':
      return (
        <Panel title="Analyst workload">
          <ListRows
            rows={data.analystWorkload.map((w) => ({
              key: w.name,
              left: (
                <Text fz={14} truncate>
                  {w.name}
                </Text>
              ),
              right: (
                <Text fw={600} ff="monospace" fz={14}>
                  {w.openTasks}
                </Text>
              ),
            }))}
          />
        </Panel>
      )
    case 'chart.sla_compliance': {
      const c = data.slaCompliance
      return (
        <Panel title="SLA compliance · 7d">
          {c.pct == null ? (
            <Text c="dimmed" fz={13} py="sm">
              No SLA policies configured.
            </Text>
          ) : (
            <Group gap="xl" align="center">
              <Text fz={44} fw={700} style={{ color: 'var(--ok)', letterSpacing: '-1px' }}>
                {c.pct}
                <span style={{ fontSize: 22 }}>%</span>
              </Text>
              <Stack gap={4}>
                <Text fz={13}>
                  met {c.met} ·{' '}
                  <Text component="span" c="var(--sev-critical)">
                    breached {c.breached}
                  </Text>
                </Text>
                <Text fz={12} c="dimmed">
                  resolve-target compliance
                </Text>
              </Stack>
            </Group>
          )}
        </Panel>
      )
    }

    default:
      return (
        <Panel title="Unknown widget">
          <Text c="dimmed" fz={13}>
            No renderer for “{type}”.
          </Text>
        </Panel>
      )
  }
}
