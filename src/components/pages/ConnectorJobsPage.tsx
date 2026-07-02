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
import type { ConnectorJobTab } from '#/components/Connectors/connectorJobs.types'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Box,
  Button,
  Group,
  Pagination,
  Paper,
  Select,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnalysisReportDrawer } from './connector-jobs/AnalysisReportDrawer'
import { errorMessage, isConnectorJobTab } from './connector-jobs/constants'
import styles from './connector-jobs/styles.module.css'
import { JobsTable } from './connector-jobs/JobsTable'

export function ConnectorJobsPage() {
  const queryClient = useQueryClient()
  const { data: jobs = [], isLoading } = useQuery(analyzerJobsQueryOptions())
  const [activeTab, setActiveTab] = useState<ConnectorJobTab>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('6')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const detailQuery = useQuery(analyzerJobDetailQueryOptions(selectedJobId))

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: analyzerJobsQueryOptions().queryKey,
    })

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

        <JobsTable
          jobs={paged}
          isLoading={isLoading}
          isEmpty={visible.length === 0}
          onOpenReport={setSelectedJobId}
          onCancel={(id) => cancelMutation.mutate(id)}
          cancelPendingId={
            cancelMutation.isPending ? cancelMutation.variables : null
          }
        />

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
              <Text component="span" className={styles.fieldLabel}>
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
