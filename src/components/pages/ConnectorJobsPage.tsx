import type {
  ConnectorJob,
  ConnectorJobReport,
  ConnectorJobReportEnrichment,
  ConnectorJobStatus,
  ConnectorJobTab,
  ConnectorJobVerdict,
} from '#/components/Connectors/connectorJobs.types'
import {
  connectorJobTabs,
  countConnectorJobsByTab,
  filterConnectorJobsByTab,
  getConnectorJobReport,
  initialConnectorJobs,
} from '#/components/Connectors/connectorJobs'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  fw: 500,
  c: 'dimmed',
  lts: '1px',
} as const

const filterLblProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

const statusColor: Record<ConnectorJobStatus, string> = {
  queued: 'gray',
  running: 'blue',
  success: 'green',
  failure: 'red',
}

const verdictColor: Record<ConnectorJobVerdict, string> = {
  MALICIOUS: 'red',
  SUSPICIOUS: 'yellow',
  INFO: 'blue',
  CLEAN: 'green',
}

function isConnectorJobTab(value: string | null): value is ConnectorJobTab {
  return connectorJobTabs.some((tab) => tab.value === value)
}

function StatusPill({ job }: { job: ConnectorJob }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Badge
        variant="light"
        color={statusColor[job.status]}
        radius="sm"
        ff="monospace"
        size="sm"
        leftSection={
          job.status === 'running' ? (
            <Loader size={12} type="oval" />
          ) : undefined
        }
      >
        {job.status}
      </Badge>
      {job.cached && (
        <Badge variant="default" radius="sm" ff="monospace" size="sm">
          cached
        </Badge>
      )}
    </Group>
  )
}

function ObservableCell({ job }: { job: ConnectorJob }) {
  return (
    <Group gap={10} wrap="nowrap" miw={0}>
      <Badge
        variant="default"
        radius="sm"
        ff="monospace"
        size="sm"
        tt="lowercase"
        style={{ flexShrink: 0 }}
      >
        {job.observableType}
      </Badge>
      <Text fw={600} truncate>
        {job.observable}
      </Text>
    </Group>
  )
}

function VerdictCell({ verdict }: { verdict?: ConnectorJobVerdict }) {
  if (!verdict) {
    return (
      <Text component="span" ff="monospace" c="dimmed">
        -
      </Text>
    )
  }

  return (
    <Badge
      variant="light"
      color={verdictColor[verdict]}
      radius="sm"
      ff="monospace"
      size="sm"
    >
      {verdict}
    </Badge>
  )
}

function ReportProperty({
  label,
  children,
  highlight,
}: {
  label: string
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Group gap={24} align="baseline" wrap="nowrap">
      <Text ff="monospace" fz={13} c="dimmed" w={150}>
        {label}
      </Text>
      <Text
        ff="monospace"
        fz={13}
        fw={highlight ? 800 : 600}
        c={highlight ? 'red.7' : 'dark.9'}
      >
        {children}
      </Text>
    </Group>
  )
}

function ReportChip({
  children,
  color = 'gray',
}: {
  children: React.ReactNode
  color?: string
}) {
  return (
    <Badge variant="outline" color={color} radius="sm" ff="monospace" fz={11}>
      {children}
    </Badge>
  )
}

function EnrichmentCard({
  enrichment,
}: {
  enrichment: ConnectorJobReportEnrichment
}) {
  return (
    <Paper bg="gray.0" p="md" radius="md" withBorder={false}>
      <Group justify="space-between" align="flex-start" gap="md" mb={10}>
        <Group gap={10} wrap="nowrap">
          <Badge
            variant="light"
            color={verdictColor[enrichment.verdict]}
            radius="sm"
            ff="monospace"
            size="sm"
          >
            {enrichment.verdict}
          </Badge>
          <Text fw={800}>{enrichment.analyzer}</Text>
        </Group>
        <Text
          ff="monospace"
          fz={12}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        >
          {enrichment.meta}
        </Text>
      </Group>

      <Group
        gap={8}
        mb={
          enrichment.artifacts?.length || enrichment.operations?.length ? 12 : 0
        }
      >
        {enrichment.chips.map((chip) => (
          <ReportChip key={chip.label} color={chip.color}>
            {chip.label}
          </ReportChip>
        ))}
      </Group>

      {enrichment.artifacts?.length ? (
        <Stack gap={8} mb={12}>
          <Text {...headerProps}>Extracted artifacts</Text>
          {enrichment.artifacts.map((artifact) => (
            <Group key={`${artifact.type}-${artifact.value}`} gap={12}>
              <Badge variant="default" radius="sm" ff="monospace" fz={11}>
                {artifact.type}
              </Badge>
              <Text ff="monospace" fz={13} fw={700}>
                {artifact.value}
              </Text>
              <Button
                ml="auto"
                size="xs"
                variant="default"
                leftSection={<Plus size={13} />}
                onClick={() =>
                  notifications.show({
                    message: `${artifact.value} added to observables`,
                  })
                }
              >
                Add
              </Button>
            </Group>
          ))}
        </Stack>
      ) : null}

      {enrichment.operations?.length ? (
        <Stack gap={8}>
          <Text {...headerProps}>Case operations</Text>
          {enrichment.operations.map((operation) => (
            <Group
              key={`${operation.action}-${operation.argument ?? ''}`}
              gap={8}
            >
              <Text component="span" ff="monospace" fz={11} c="dark.7">
                ▶
              </Text>
              <Badge variant="default" radius="sm" ff="monospace" fz={12}>
                {operation.action}
              </Badge>
              {operation.argument && (
                <Text ff="monospace" fz={13} fw={700}>
                  {operation.argument}
                </Text>
              )}
            </Group>
          ))}
        </Stack>
      ) : null}
    </Paper>
  )
}

function AnalysisReportDrawer({
  report,
  onClose,
}: {
  report: ConnectorJobReport | null
  onClose: () => void
}) {
  return (
    <Drawer
      opened={report !== null}
      onClose={onClose}
      position="right"
      size={760}
      title="Analysis job report"
      padding={0}
      styles={{
        header: { borderBottom: '1px solid var(--mantine-color-gray-2)' },
        title: {
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--mantine-color-gray-6)',
        },
        body: { padding: 0 },
      }}
    >
      {report && (
        <Box>
          <Box
            px="xl"
            py="lg"
            style={{
              borderLeft: `5px solid var(--mantine-color-${verdictColor[report.verdict]}-6)`,
            }}
          >
            <Text {...headerProps}>Observable · {report.observableType}</Text>
            <Text ff="monospace" fz={18} fw={800} mt={8}>
              {report.observable}
            </Text>
            <Badge
              mt="sm"
              variant="light"
              color={verdictColor[report.verdict]}
              radius="sm"
              ff="monospace"
            >
              {report.verdict}
            </Badge>
          </Box>

          <Divider />

          <Stack gap={10} px="xl" py="lg">
            <Text {...headerProps}>Properties</Text>
            <ReportProperty label="Type">
              {report.observableType}
            </ReportProperty>
            <ReportProperty label="Value">{report.observable}</ReportProperty>
            <ReportProperty label="IOC" highlight={report.properties.ioc}>
              {report.properties.ioc ? 'yes' : 'no'}
            </ReportProperty>
            <ReportProperty label="Sighted">
              {report.properties.sighted ? 'yes' : 'no'}
            </ReportProperty>
            <ReportProperty label="First seen">
              {report.properties.firstSeen}
            </ReportProperty>
            <ReportProperty label="Source">
              {report.properties.source}
            </ReportProperty>
          </Stack>

          <Divider />

          <Stack gap="sm" px="xl" py="lg">
            <Group justify="space-between" align="center">
              <Text {...headerProps}>Enrichment</Text>
              <Button
                size="xs"
                variant="default"
                leftSection={
                  <Text component="span" fz={11}>
                    ▶
                  </Text>
                }
                onClick={() =>
                  notifications.show({
                    message: `Analyzers queued for ${report.observable}`,
                  })
                }
              >
                Run analyzers
              </Button>
            </Group>
            {report.enrichments.map((enrichment) => (
              <EnrichmentCard key={enrichment.id} enrichment={enrichment} />
            ))}
          </Stack>

          <Divider />

          <Stack gap="sm" px="xl" py="lg">
            <Text {...headerProps}>Seen in cases</Text>
            {report.seenInCases.length ? (
              report.seenInCases.map((caseItem) => (
                <Group
                  key={caseItem.id}
                  gap={10}
                  justify="space-between"
                  align="center"
                  wrap="nowrap"
                >
                  <Text fw={700}>
                    {caseItem.id} {caseItem.title}
                  </Text>
                  <Badge
                    variant="light"
                    color="yellow"
                    radius="sm"
                    ff="monospace"
                    style={{ flexShrink: 0 }}
                  >
                    {caseItem.status}
                  </Badge>
                </Group>
              ))
            ) : (
              <Text c="dimmed" fz={13}>
                This observable has not been linked to a case yet.
              </Text>
            )}
          </Stack>

          <Divider />

          <Group gap="sm" px="xl" py="md" justify="flex-end">
            <Button
              variant="default"
              onClick={() =>
                notifications.show({
                  message: `${report.observable} IOC flag toggled`,
                })
              }
            >
              Toggle IOC
            </Button>
            <Button
              variant="default"
              onClick={() =>
                notifications.show({
                  message: `${report.observable} marked sighted`,
                })
              }
            >
              Mark sighted
            </Button>
            <Button
              onClick={() =>
                notifications.show({
                  color: 'ginger',
                  message: `${report.observable} export queued for MISP`,
                })
              }
            >
              Export to MISP
            </Button>
          </Group>
        </Box>
      )}
    </Drawer>
  )
}

export function ConnectorJobsPage() {
  const [jobs, setJobs] = useState<ConnectorJob[]>(initialConnectorJobs)
  const [activeTab, setActiveTab] = useState<ConnectorJobTab>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('6')
  const [activeReport, setActiveReport] = useState<ConnectorJobReport | null>(
    null,
  )

  const visible = useMemo(
    () => filterConnectorJobsByTab(jobs, activeTab),
    [jobs, activeTab],
  )
  const counts = useMemo(() => countConnectorJobsByTab(jobs), [jobs])

  const perPage = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(visible.length / perPage))

  useEffect(() => {
    setPage(1)
  }, [activeTab, perPage])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const paged = useMemo(
    () => visible.slice((page - 1) * perPage, page * perPage),
    [visible, page, perPage],
  )

  const rangeStart = visible.length === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, visible.length)

  const retryFailed = () => {
    const failed = jobs.filter((job) => job.status === 'failure')
    if (failed.length === 0) {
      notifications.show({ message: 'No failed connector jobs to retry' })
      return
    }

    setJobs((current) =>
      current.map((job) =>
        job.status === 'failure'
          ? {
              ...job,
              status: 'queued',
              verdict: undefined,
              duration: undefined,
              started: undefined,
              cached: false,
            }
          : job,
      ),
    )
    notifications.show({
      color: 'blue',
      message: `${failed.length} failed connector job${
        failed.length > 1 ? 's' : ''
      } queued for retry`,
    })
  }

  const clearFinished = () => {
    const finished = jobs.filter(
      (job) => job.status === 'success' || job.status === 'failure',
    )
    if (finished.length === 0) {
      notifications.show({ message: 'No finished connector jobs to clear' })
      return
    }

    setJobs((current) =>
      current.filter(
        (job) => job.status !== 'success' && job.status !== 'failure',
      ),
    )
    notifications.show({
      message: `${finished.length} finished connector job${
        finished.length > 1 ? 's' : ''
      } cleared`,
    })
  }

  const cancelJob = (id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id))
    notifications.show({ message: `${id} cancelled` })
  }

  const openReport = (id: string) => {
    const report = getConnectorJobReport(id)
    if (!report) {
      notifications.show({ message: `No report available for ${id}` })
      return
    }

    setActiveReport(report)
  }

  return (
    <Box className={classes.page}>
      <Group align="center" gap={14} mb={24} wrap="wrap">
        <Group align="baseline" gap={14} wrap="wrap">
          <Title order={1} size="h2">
            Analyzer jobs
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            enrichment job queue · results cache 24h · click a job for its
            report
          </Text>
        </Group>
        <Group gap={10} ml="auto" wrap="wrap">
          <Button
            variant="default"
            leftSection={<RotateCcw size={16} />}
            onClick={retryFailed}
          >
            Retry failed
          </Button>
          <Button
            variant="default"
            leftSection={<Trash2 size={16} />}
            onClick={clearFinished}
          >
            Clear finished
          </Button>
        </Group>
      </Group>

      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (isConnectorJobTab(value)) setActiveTab(value)
        }}
        variant="pills"
        color="dark"
        radius="md"
        mb="lg"
      >
        <Tabs.List>
          {connectorJobTabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              <Group gap={7} wrap="nowrap">
                <Text component="span" fw={600}>
                  {tab.label}
                </Text>
                <Text component="span" ff="monospace" fz={11} c="dimmed">
                  {counts[tab.value]}
                </Text>
              </Group>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Paper radius="md" p={0} withBorder shadow="xs">
        <Group
          gap={12}
          px={18}
          py={14}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Text fz={16} fw={700}>
            Jobs
          </Text>
          <Text
            component="span"
            ff="monospace"
            fz={11}
            c="var(--muted)"
            style={(theme) => ({
              background: `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`,
              border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
              padding: '1px 8px',
              borderRadius: 99,
            })}
          >
            {visible.length} jobs
          </Text>
        </Group>

        <Table.ScrollContainer minWidth={1020}>
          <Table
            highlightOnHover
            horizontalSpacing="lg"
            verticalSpacing="md"
            borderColor="var(--line-soft)"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th {...headerProps}>Job</Table.Th>
                <Table.Th {...headerProps}>Observable</Table.Th>
                <Table.Th {...headerProps}>Plugin</Table.Th>
                <Table.Th {...headerProps}>Status</Table.Th>
                <Table.Th {...headerProps}>Verdict</Table.Th>
                <Table.Th {...headerProps}>Started</Table.Th>
                <Table.Th {...headerProps}>Duration</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paged.map((job) => (
                <Table.Tr
                  key={job.id}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    job.status === 'success'
                      ? openReport(job.id)
                      : notifications.show({ message: `${job.id} selected` })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') openReport(job.id)
                  }}
                >
                  <Table.Td
                    ff="monospace"
                    fz={12}
                    fw={700}
                    c="var(--muted)"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {job.id}
                  </Table.Td>
                  <Table.Td maw={420}>
                    <ObservableCell job={job} />
                  </Table.Td>
                  <Table.Td fw={600}>{job.plugin}</Table.Td>
                  <Table.Td>
                    <StatusPill job={job} />
                  </Table.Td>
                  <Table.Td>
                    <VerdictCell verdict={job.verdict} />
                  </Table.Td>
                  <Table.Td
                    ff="monospace"
                    fz={12}
                    c="dimmed"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {job.started ?? '-'}
                  </Table.Td>
                  <Table.Td
                    ff="monospace"
                    fz={12}
                    c="dimmed"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {job.duration ?? '-'}
                  </Table.Td>
                  <Table.Td
                    ta="right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {job.status === 'success' ? (
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => openReport(job.id)}
                      >
                        Report
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => cancelJob(job.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
              {visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8} ta="center" c="dimmed" fz={13} py={42}>
                    No connector jobs match this queue.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        <Group
          gap={12}
          px={18}
          py={12}
          wrap="wrap"
          style={{ borderTop: '1px solid var(--line-soft)' }}
        >
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {rangeStart}–{rangeEnd} of {visible.length}
          </Text>
          <Group gap="md" wrap="nowrap" ml="auto">
            <Group gap="xs" wrap="nowrap">
              <Text component="span" {...filterLblProps}>
                rows
              </Text>
              <Select
                size="xs"
                w={76}
                data={['6', '10', '25']}
                value={pageSize}
                onChange={(value) => setPageSize(value ?? '6')}
                allowDeselect={false}
              />
            </Group>
            <Pagination.Root
              total={totalPages}
              value={page}
              onChange={setPage}
              size="sm"
            >
              <Group gap={5} wrap="nowrap">
                <Pagination.First />
                <Pagination.Previous />
                <Text
                  component="span"
                  ff="monospace"
                  fz={12}
                  c="var(--muted)"
                  px={6}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {page} / {totalPages}
                </Text>
                <Pagination.Next />
                <Pagination.Last />
              </Group>
            </Pagination.Root>
          </Group>
        </Group>
      </Paper>

      <AnalysisReportDrawer
        report={activeReport}
        onClose={() => setActiveReport(null)}
      />
    </Box>
  )
}
