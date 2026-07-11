import { overviewQueryOptions } from '#/components/Overview/overviewQueries'
import type { TriageAlert } from '#/components/Overview/overviewQueries'
// Reuse the list pages' `.page` scope for the shared SOC palette
// (severity / TLP / MITRE colours, soft borders) the Severity/Tag components read.
import pageClasses from '#/components/Cases/CasesPage.module.css'
import classes from './overview/OverviewPage.module.css'
import { Severity } from '#/components/Severity/Severity'
import { Tag } from '#/components/Tag/Tag'
import { TableTlpBadge } from '#/components/Tlp/TableTlpBadge'
import { RelativeTime } from '#/components/Time/RelativeTime'
import {
  AreaChart,
  BarsList,
  DonutChart,
  LineChart,
  Sparkline,
} from '@mantine/charts'
import {
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Plus, RefreshCw, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'

// Mantine palette refs so DonutChart segments read the same as the severity
// heat bars used across the app.
const SEV_DONUT: Record<string, string> = {
  critical: 'red.6',
  high: 'orange.6',
  medium: 'yellow.6',
  low: 'blue.6',
}

// Case-pipeline stage → segment colour (New unassigned → blue, In progress →
// orange, terminal states green/grey).
const PIPELINE_COLOR: Record<string, string> = {
  New: 'blue.6',
  'In progress': 'orange.6',
  Resolved: 'green.6',
  Duplicated: 'gray.5',
}

// Case resolution disposition → segment colour (true positives read as the
// alarming red; benign/duplicate outcomes stay cool/neutral).
const RESOLUTION_COLOR: Record<string, string> = {
  'True positive': 'red.6',
  'False positive': 'gray.5',
  Indeterminate: 'yellow.6',
  Other: 'grape.5',
  Duplicated: 'blue.5',
  Unset: 'gray.4',
}

// Rotating palette for the alerts-by-source bars (feeds carry no inherent
// colour, so distinct-but-neutral hues just aid scanning).
const SOURCE_PALETTE = [
  'indigo.6',
  'teal.6',
  'grape.6',
  'cyan.6',
  'orange.6',
  'lime.6',
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SEV_ORDER = ['critical', 'high', 'medium', 'low'] as const
const SEV_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

/** A signed change indicator. Higher is always worse here (more open cases,
 * more alerts, slower MTTR), so a rise reads red and a fall reads green. */
function Delta({
  value,
  format,
  label,
}: {
  value: number | null
  format: (n: number) => string
  label: string
}) {
  if (value == null) {
    return (
      <Text fz={12} c="dimmed">
        — {label}
      </Text>
    )
  }
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '·'
  const color =
    value > 0 ? 'var(--sev-critical)' : value < 0 ? 'var(--ok)' : undefined
  return (
    <Text fz={12} c={color ? undefined : 'dimmed'} style={{ color }}>
      {arrow} {format(Math.abs(value))} {label}
    </Text>
  )
}

function Panel({
  title,
  right,
  children,
}: {
  title: React.ReactNode
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box className={classes.card}>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs">
          {typeof title === 'string' ? (
            <Text fw={700} fz={16}>
              {title}
            </Text>
          ) : (
            title
          )}
        </Group>
        {right}
      </Group>
      {children}
    </Box>
  )
}

type DonutDatum = { name: string; value: number; color: string }

/** Colour-keyed legend beside the severity donut — keeps exact per-level counts
 * scannable, which a donut alone hides. */
function DonutLegend({ data }: { data: DonutDatum[] }) {
  return (
    <Stack gap={7} miw={116}>
      {data.map((d) => (
        <Group key={d.name} gap={8} justify="space-between" wrap="nowrap">
          <Group gap={7} wrap="nowrap">
            <Box
              w={9}
              h={9}
              style={{
                borderRadius: 2,
                background: `var(--mantine-color-${d.color.replace('.', '-')})`,
              }}
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
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function OverviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    overviewQueryOptions(),
  )
  const [sevFilter, setSevFilter] = useState<string>('all')

  const triageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const a of data?.triageQueue ?? []) {
      counts.all += 1
      const name = SEV_ORDER.find((s) => SEV_RANK[s] === a.sev)
      if (name) counts[name] += 1
    }
    return counts
  }, [data])

  if (isPending) {
    return (
      <Box className={pageClasses.page}>
        <Center mih={400}>
          <Loader />
        </Center>
      </Box>
    )
  }

  if (isError) {
    return (
      <Box className={pageClasses.page}>
        <Stack align="center" mih={400} justify="center" gap="sm">
          <Text c="dimmed">Couldn’t load the overview from the backend.</Text>
          <Button variant="default" onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Box>
    )
  }

  const { stats } = data
  const openTriage =
    sevFilter === 'all'
      ? data.triageQueue
      : data.triageQueue.filter((a) => a.sev === SEV_RANK[sevFilter])

  const openAlert = (id: string) =>
    void navigate({ to: '/alerts/$alertId', params: { alertId: id } })

  const chartData = data.ingestion24h.map((p) => ({
    time: dayjs(p.hour).format('HH:mm'),
    ingested: p.ingested,
    promoted: p.promoted,
  }))

  const severityDonut = data.alertsBySeverity.map((d) => ({
    name: cap(d.label),
    value: d.count,
    color: SEV_DONUT[d.label] ?? 'gray.5',
  }))

  const pipelineBars = data.casePipeline.map((d) => ({
    name: d.label,
    value: d.count,
    color: PIPELINE_COLOR[d.label] ?? 'gray.5',
  }))

  const ingestionSpark = data.ingestion24h.map((p) => p.ingested)

  const trendData = data.caseTrend.map((p) => ({
    date: dayjs(p.date).format('DD MMM'),
    opened: p.opened,
    resolved: p.resolved,
  }))

  const resolutionDonut = data.resolutionBreakdown.map((d) => ({
    name: d.label,
    value: d.count,
    color: RESOLUTION_COLOR[d.label] ?? 'gray.5',
  }))
  const resolutionTotal = resolutionDonut.reduce((sum, d) => sum + d.value, 0)

  const sourceBars = data.alertsBySource.map((d, i) => ({
    name: d.label,
    value: d.count,
    color: SOURCE_PALETTE[i % SOURCE_PALETTE.length],
  }))

  const sevTabs: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ]

  return (
    <Box className={pageClasses.page}>
      {/* --- Title row --- */}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Box>
          <Title order={1} fz={30} fw={700}>
            SOC Overview
          </Title>
          <Text ff="monospace" fz={13} c="dimmed" mt={4}>
            {dayjs(data.generatedAt).format('ddd, DD MMMM YYYY, h:mm a')}
          </Text>
        </Box>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<RefreshCw size={16} />}
            loading={isFetching}
            onClick={() => {
              void queryClient.invalidateQueries(overviewQueryOptions())
            }}
          >
            Refresh
          </Button>
          <Button
            color="orange"
            leftSection={<Plus size={16} />}
            onClick={() => void navigate({ to: '/cases/create' })}
          >
            New case
          </Button>
        </Group>
      </Group>

      {/* --- KPI tiles --- */}
      <Box className={classes.kpiGrid}>
        <Box className={classes.card}>
          <Text className={classes.kpiLabel}>Open cases</Text>
          <Text className={classes.kpiValue} my={8}>
            {stats.openCases}
          </Text>
          <Delta
            value={stats.openCasesDelta}
            format={(n) => `${n}`}
            label="vs yesterday"
          />
        </Box>

        <Box className={classes.card}>
          <Text className={classes.kpiLabel}>New alerts · 24h</Text>
          <Group justify="space-between" align="flex-end" wrap="nowrap" gap="sm">
            <Text className={classes.kpiValue} my={8}>
              {stats.newAlerts24h}
            </Text>
            {ingestionSpark.some((n) => n > 0) && (
              <Sparkline
                w={96}
                h={38}
                data={ingestionSpark}
                curveType="natural"
                color="blue.5"
                fillOpacity={0.15}
              />
            )}
          </Group>
          <Delta
            value={stats.newAlertsDeltaPct}
            format={(n) => `${n}%`}
            label="vs 7-day avg"
          />
        </Box>

        <Box
          className={`${classes.card} ${
            stats.slaBreaches > 0 ? classes.kpiAccent : ''
          }`}
        >
          <Text className={classes.kpiLabel}>SLA breaches</Text>
          <Text
            className={classes.kpiValue}
            my={8}
            style={{
              color: stats.slaBreaches > 0 ? 'var(--sev-critical)' : undefined,
            }}
          >
            {stats.slaBreaches}
          </Text>
          <Text fz={12} c="dimmed">
            {stats.slaBreachesCritical} critical · {stats.slaBreachesHigh} high
          </Text>
        </Box>

        <Box className={classes.card}>
          <Text className={classes.kpiLabel}>MTTR · 7 days</Text>
          <Text className={classes.kpiValue} my={8}>
            {stats.mttrHours7d == null ? '—' : stats.mttrHours7d}
            {stats.mttrHours7d != null && (
              <span className={classes.kpiUnit}>h</span>
            )}
          </Text>
          <Delta
            value={stats.mttrDeltaHours}
            format={(n) => `${n}h`}
            label="vs last week"
          />
        </Box>
      </Box>

      {/* --- Main grid --- */}
      <Box className={classes.grid}>
        {/* Left column */}
        <Stack gap={20}>
          <Panel
            title={
              <>
                <Text fw={700} fz={16}>
                  Alert triage queue
                </Text>
                <Badge variant="light" color="gray" radius="sm">
                  {triageCounts.all} open
                </Badge>
              </>
            }
            right={
              <Anchor
                fz={13}
                fw={600}
                onClick={() => void navigate({ to: '/alerts' })}
              >
                View all →
              </Anchor>
            }
          >
            <Group gap={6} mb={4}>
              {sevTabs.map((tab) => (
                <UnstyledButton
                  key={tab.key}
                  onClick={() => setSevFilter(tab.key)}
                  px={10}
                  py={5}
                  style={{
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      sevFilter === tab.key
                        ? 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))'
                        : 'transparent',
                  }}
                >
                  {tab.label}{' '}
                  <Text component="span" c="dimmed" fz={13}>
                    {triageCounts[tab.key]}
                  </Text>
                </UnstyledButton>
              ))}
            </Group>

            {openTriage.length === 0 ? (
              <Text c="dimmed" fz={13} py="md">
                No open alerts in this bucket.
              </Text>
            ) : (
              <Box>
                {openTriage.map((a: TriageAlert) => (
                  <Box
                    key={a.id}
                    className={classes.triageRow}
                    onClick={() => openAlert(a.id)}
                  >
                    <Severity id={a.id} sev={a.sev} />
                    <Box miw={0}>
                      <Text fw={600} fz={14} truncate>
                        {a.title}
                      </Text>
                      {a.tags.length > 0 && (
                        <Group gap={5} mt={4} wrap="nowrap">
                          {a.tags.slice(0, 3).map((t) => (
                            <Tag key={t} label={t} size="xs" />
                          ))}
                        </Group>
                      )}
                    </Box>
                    <Text
                      className={classes.triageHideSm}
                      fz={13}
                      c="dimmed"
                      truncate
                      maw={120}
                    >
                      {a.source}
                    </Text>
                    <Box className={classes.triageHideSm}>
                      <TableTlpBadge tlp={a.tlp} />
                    </Box>
                    <Group gap={4} wrap="nowrap" justify="flex-end" miw={54}>
                      {a.breach && (
                        <TriangleAlert
                          size={14}
                          color="var(--sev-critical)"
                        />
                      )}
                      <RelativeTime iso={a.date} fz={13} c="dimmed" />
                    </Group>
                  </Box>
                ))}
              </Box>
            )}
          </Panel>

          <Panel title="Alert ingestion · last 24h">
            <AreaChart
              h={220}
              data={chartData}
              dataKey="time"
              withDots={false}
              curveType="natural"
              withLegend
              series={[
                { name: 'ingested', color: 'blue.5' },
                { name: 'promoted', color: 'orange.5' },
              ]}
              areaProps={(series) =>
                series.name === 'promoted'
                  ? { fillOpacity: 0, strokeDasharray: '5 5' }
                  : { fillOpacity: 0.15 }
              }
            />
          </Panel>

          <Panel title={`Case trend · ${data.trendDays} days`}>
            <LineChart
              h={200}
              data={trendData}
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
        </Stack>

        {/* Right column */}
        <Stack gap={20}>
          <Panel title="Open alerts by severity">
            {data.openAlertsTotal === 0 ? (
              <Text c="dimmed" fz={13} py="sm">
                No open alerts.
              </Text>
            ) : (
              <Group justify="space-between" wrap="nowrap" gap="lg">
                <DonutChart
                  data={severityDonut}
                  size={148}
                  thickness={20}
                  paddingAngle={2}
                  withTooltip
                  tooltipDataSource="segment"
                  chartLabel={`${data.openAlertsTotal} open`}
                  mx="auto"
                />
                <DonutLegend data={severityDonut} />
              </Group>
            )}
          </Panel>

          <Panel title="Alerts by source">
            {sourceBars.length === 0 ? (
              <Text c="dimmed" fz={13} py="sm">
                No alerts yet.
              </Text>
            ) : (
              <BarsList data={sourceBars} barHeight={24} barGap="sm" />
            )}
          </Panel>

          <Panel title="Case pipeline">
            <BarsList
              data={pipelineBars}
              barHeight={26}
              barGap="sm"
              valueLabel="cases"
            />
          </Panel>

          <Panel title="Case resolutions">
            {resolutionTotal === 0 ? (
              <Text c="dimmed" fz={13} py="sm">
                No resolved cases yet.
              </Text>
            ) : (
              <Group justify="space-between" wrap="nowrap" gap="lg">
                <DonutChart
                  data={resolutionDonut}
                  size={148}
                  thickness={20}
                  paddingAngle={2}
                  withTooltip
                  tooltipDataSource="segment"
                  chartLabel={`${resolutionTotal} closed`}
                  mx="auto"
                />
                <DonutLegend data={resolutionDonut} />
              </Group>
            )}
          </Panel>

          <Panel
            title={
              <>
                <Text fw={700} fz={16}>
                  Analyst workload
                </Text>
                <Badge variant="light" color="gray" radius="sm">
                  open tasks
                </Badge>
              </>
            }
          >
            {data.analystWorkload.length === 0 ? (
              <Text c="dimmed" fz={13}>
                No open tasks.
              </Text>
            ) : (
              <Box>
                {data.analystWorkload.map((w) => (
                  <Box key={w.name} className={classes.listRow}>
                    <Group gap="sm" wrap="nowrap" miw={0}>
                      <Center
                        w={30}
                        h={30}
                        style={{
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                          background:
                            'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
                        }}
                      >
                        {w.name === 'Unassigned' ? '—' : initials(w.name)}
                      </Center>
                      <Text fz={14} truncate>
                        {w.name}
                      </Text>
                    </Group>
                    <Text fw={600} ff="monospace" fz={14}>
                      {w.openTasks}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </Panel>

          <Panel
            title={
              <>
                <Text fw={700} fz={16}>
                  Latest observables
                </Text>
                <Badge variant="light" color="gray" radius="sm">
                  {data.latestObservables.length} new
                </Badge>
              </>
            }
          >
            {data.latestObservables.length === 0 ? (
              <Text c="dimmed" fz={13}>
                No recent observables.
              </Text>
            ) : (
              <Box>
                {data.latestObservables.map((o) => (
                  <Box key={o.id} className={classes.listRow}>
                    <Group gap="sm" wrap="nowrap" miw={0}>
                      <Badge
                        variant="default"
                        radius="sm"
                        ff="monospace"
                        tt="none"
                      >
                        {o.type}
                      </Badge>
                      <Text ff="monospace" fz={13} truncate maw={200}>
                        {o.value}
                      </Text>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      {o.ioc && (
                        <Text ff="monospace" fz={11} c="var(--sev-critical)">
                          IOC
                        </Text>
                      )}
                      <RelativeTime iso={o.date} fz={12} c="dimmed" />
                    </Group>
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        </Stack>
      </Box>
    </Box>
  )
}
