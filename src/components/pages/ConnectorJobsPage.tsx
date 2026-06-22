import type {
  ConnectorJob,
  ConnectorJobDetail,
  ConnectorJobStatus,
  ConnectorJobTab,
  ConnectorJobVerdict,
} from '#/components/Connectors/connectorJobs.types'
import {
  analyzerJobDetailQueryOptions,
  analyzerJobsQueryOptions,
  cancelAnalyzerJob,
  clearFinishedAnalyzerJobs,
  connectorJobTabs,
  countConnectorJobsByTab,
  filterConnectorJobsByTab,
  retryFailedAnalyzerJobs,
} from '#/components/Connectors/connectorJobs'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Badge,
  Box,
  Button,
  Code,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'
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

function isTerminal(status: ConnectorJobStatus) {
  return status === 'success' || status === 'failure'
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
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
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Group gap={24} align="baseline" wrap="nowrap">
      <Text ff="monospace" fz={13} c="dimmed" w={120} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text ff="monospace" fz={13} fw={600} c="dark.9" style={{ wordBreak: 'break-word' }}>
        {children}
      </Text>
    </Group>
  )
}

function renderReportValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function AnalysisReportDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: ConnectorJobDetail | null
  loading: boolean
  onClose: () => void
}) {
  const reportEntries = detail?.report ? Object.entries(detail.report) : []

  return (
    <Drawer
      opened={loading || detail !== null}
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
      {loading && !detail ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      ) : detail ? (
        <Box>
          <Box
            px="xl"
            py="lg"
            style={{
              borderLeft: detail.verdict
                ? `5px solid var(--mantine-color-${verdictColor[detail.verdict]}-6)`
                : '5px solid var(--mantine-color-gray-4)',
            }}
          >
            <Text {...headerProps}>Observable · {detail.observableType}</Text>
            <Text ff="monospace" fz={18} fw={800} mt={8} style={{ wordBreak: 'break-word' }}>
              {detail.observable}
            </Text>
            <Group gap={8} mt="sm">
              <Badge
                variant="light"
                color={statusColor[detail.status]}
                radius="sm"
                ff="monospace"
              >
                {detail.status}
              </Badge>
              {detail.verdict && (
                <Badge
                  variant="light"
                  color={verdictColor[detail.verdict]}
                  radius="sm"
                  ff="monospace"
                >
                  {detail.verdict}
                </Badge>
              )}
              {detail.cached && (
                <Badge variant="default" radius="sm" ff="monospace">
                  cached
                </Badge>
              )}
            </Group>
          </Box>

          <Divider />

          <Stack gap={10} px="xl" py="lg">
            <Text {...headerProps}>Job</Text>
            <ReportProperty label="Analyzer">
              {detail.plugin} {detail.version && `· ${detail.version}`}
            </ReportProperty>
            <ReportProperty label="Type">{detail.observableType}</ReportProperty>
            <ReportProperty label="TLP">{detail.tlp}</ReportProperty>
            <ReportProperty label="Attempts">{detail.attempts}</ReportProperty>
            <ReportProperty label="Queued">{detail.queued ?? '—'}</ReportProperty>
            <ReportProperty label="Started">{detail.started ?? '—'}</ReportProperty>
            <ReportProperty label="Ended">{detail.ended ?? '—'}</ReportProperty>
            <ReportProperty label="Duration">{detail.duration ?? '—'}</ReportProperty>
          </Stack>

          {detail.error && (
            <>
              <Divider />
              <Stack gap={8} px="xl" py="lg">
                <Text {...headerProps}>Error</Text>
                <Text ff="monospace" fz={13} c="red.7" style={{ wordBreak: 'break-word' }}>
                  {detail.error}
                </Text>
              </Stack>
            </>
          )}

          {detail.tags.length > 0 && (
            <>
              <Divider />
              <Stack gap={10} px="xl" py="lg">
                <Text {...headerProps}>Verdict badges</Text>
                <Group gap={8}>
                  {detail.tags.map((tag) => (
                    <Badge
                      key={`${tag.namespace}-${tag.predicate}-${tag.value}`}
                      variant="outline"
                      color={verdictColor[tag.level]}
                      radius="sm"
                      ff="monospace"
                      fz={11}
                    >
                      {tag.namespace}:{tag.predicate}={tag.value}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </>
          )}

          <Divider />

          <Stack gap={10} px="xl" py="lg">
            <Text {...headerProps}>Analyzer report</Text>
            {reportEntries.length > 0 ? (
              <Stack gap={8}>
                {reportEntries.map(([key, value]) => (
                  <Group key={key} gap={24} align="flex-start" wrap="nowrap">
                    <Text ff="monospace" fz={13} c="dimmed" w={150} style={{ flexShrink: 0 }}>
                      {key}
                    </Text>
                    <Code block style={{ flex: 1, fontSize: 12 }}>
                      {renderReportValue(value)}
                    </Code>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" fz={13}>
                This job returned no report payload.
              </Text>
            )}
          </Stack>
        </Box>
      ) : null}
    </Drawer>
  )
}

export function ConnectorJobsPage() {
  const queryClient = useQueryClient()
  const { data: jobs = [], isLoading } = useQuery(analyzerJobsQueryOptions())
  const [activeTab, setActiveTab] = useState<ConnectorJobTab>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('6')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const detailQuery = useQuery(analyzerJobDetailQueryOptions(selectedJobId))

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: analyzerJobsQueryOptions().queryKey })

  const retryMutation = useMutation({
    mutationFn: retryFailedAnalyzerJobs,
    onSuccess: (count) => {
      invalidateList()
      notifications.show({
        color: count > 0 ? 'blue' : 'gray',
        message:
          count > 0
            ? `${count} failed job${count > 1 ? 's' : ''} queued for retry`
            : 'No failed jobs to retry',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to retry jobs: ${errorMessage(error)}`,
      }),
  })

  const clearMutation = useMutation({
    mutationFn: clearFinishedAnalyzerJobs,
    onSuccess: (count) => {
      invalidateList()
      notifications.show({
        message:
          count > 0
            ? `${count} finished job${count > 1 ? 's' : ''} cleared`
            : 'No finished jobs to clear',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to clear jobs: ${errorMessage(error)}`,
      }),
  })

  const cancelMutation = useMutation({
    mutationFn: cancelAnalyzerJob,
    onSuccess: (_data, id) => {
      invalidateList()
      notifications.show({ message: `${id.slice(0, 8)} cancelled` })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to cancel job: ${errorMessage(error)}`,
      }),
  })

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
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate()}
          >
            Retry failed
          </Button>
          <Button
            variant="default"
            leftSection={<Trash2 size={16} />}
            loading={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
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
                  style={{ cursor: isTerminal(job.status) ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (isTerminal(job.status)) setSelectedJobId(job.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && isTerminal(job.status)) {
                      setSelectedJobId(job.id)
                    }
                  }}
                >
                  <Table.Td
                    ff="monospace"
                    fz={12}
                    fw={700}
                    c="var(--muted)"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {job.ref}
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
                    {isTerminal(job.status) ? (
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        Report
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="xs"
                        loading={
                          cancelMutation.isPending &&
                          cancelMutation.variables === job.id
                        }
                        onClick={() => cancelMutation.mutate(job.id)}
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
                    {isLoading
                      ? 'Loading analyzer jobs…'
                      : 'No analyzer jobs match this queue.'}
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
        detail={detailQuery.data ?? null}
        loading={selectedJobId !== null && detailQuery.isLoading}
        onClose={() => setSelectedJobId(null)}
      />
    </Box>
  )
}
