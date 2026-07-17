/**
 * RunsPage — the plugin runs queue table with pagination, cancel/retry/clear,
 * and row detail drawer showing the full-stack trace.
 */

import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core'
import { AppDrawer } from '#/components/ui/AppDrawer'
import { RefreshCw } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'

import type { PluginRun, PluginRunStatus } from '#/components/Plugins/plugins.types'
import {
  pluginRunsQueryOptions,
  cancelPluginRun,
  retryFailedRuns,
  clearFinishedRuns,
  runKeys,
  pluginRunDetailQueryOptions,
} from '#/components/Plugins/pluginRuns'
import { observableDetailQueryOptions } from '#/components/Observables/observablesQueries'
import { observableTypeLabels } from '#/components/Observables/observables'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { Token } from '#/components/Table/TokenSearch'
import classes from '#/components/Cases/CasesPage.module.css'
import { buildRunFilterFields, filterRuns } from './runFilterSearch'
import { useStamp, errorMessage } from '#/lib/ui-helpers'

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  queued: 'gray',
  accepted: 'blue',
  running: 'blue',
  success: 'green',
  failure: 'red',
  timeout: 'orange',
  cancelled: 'gray',
  cancelling: 'orange',
  skipped: 'gray',
}

function StatusBadge({ status }: { status: PluginRunStatus }) {
  return (
    <Badge
      variant="light"
      color={STATUS_COLOR[status] ?? 'gray'}
      radius="sm"
      size="sm"
    >
      {status}
    </Badge>
  )
}

// ── Duration helper ─────────────────────────────────────────────────────────

function duration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// Raw milliseconds for sorting (formatted strings like "165ms"/"1.2s" would sort
// lexically). Unknown/unfinished durations sort first as -1.
function durationMs(start: string | null, end: string | null): number {
  if (!start || !end) return -1
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms < 0 ? -1 : ms
}

// ── Run detail drawer ───────────────────────────────────────────────────────

function RunDetailDrawer({
  runId,
  onClose,
}: {
  runId: string | null
  onClose: () => void
}) {
  const { data: run, isPending } = useQuery(pluginRunDetailQueryOptions(runId))

  // When the delivered object is an observable, resolve its human-readable
  // type + value so the drawer shows those instead of the raw UUID.
  const observableId =
    run?.eventObjectType === 'observable' ? run.eventObjectId : null
  const { data: observable } = useQuery(observableDetailQueryOptions(observableId))

  if (!runId) return null

  return (
    <AppDrawer
      opened
      onClose={onClose}
      size="lg"
      title={`Run ${runId.slice(0, 8)}`}
    >
      {isPending ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : run ? (
        <Stack gap="md">
          {/* Timeline: event → delivery → run → result */}
          <Paper p="md" radius="md" withBorder>
            <Text fz={14} fw={600} mb="md">Trace</Text>

            <Timeline
              active={run.startedAt ? 3 : 2}
              bulletSize={14}
              lineWidth={2}
            >
              <Timeline.Item color="blue" title="Event">
                <Text fz={12}>{run.eventType}</Text>
                <Text fz={11} c="dimmed" ff="monospace">
                  {run.eventId}
                </Text>
              </Timeline.Item>

              <Timeline.Item color="violet" title="Delivery">
                {observable ? (
                  <>
                    <Text fz={12}>{observableTypeLabels[observable.type]}</Text>
                    <Text fz={12} ff="monospace" style={{ wordBreak: 'break-all' }}>
                      {observable.value}
                    </Text>
                  </>
                ) : (
                  <Text fz={12}>
                    {run.eventObjectType ?? '—'} / {run.eventObjectId ?? '—'}
                  </Text>
                )}
                <Text fz={11} c="dimmed" ff="monospace">
                  plugin: {run.pluginId}
                </Text>
              </Timeline.Item>

              <Timeline.Item color="orange" title="Run">
                <Group gap={4} mb={2}>
                  <StatusBadge status={run.status} />
                  {run.skipReason && (
                    <Badge variant="outline" size="xs">
                      {run.skipReason}
                    </Badge>
                  )}
                </Group>
                <Text fz={11} c="dimmed" ff="monospace">
                  runner: {run.runnerId}
                </Text>
              </Timeline.Item>

              {run.startedAt && (
                <Timeline.Item color="gray" title="Timing">
                  <Text fz={11} ff="monospace">
                    started: {dayjs(run.startedAt).format('HH:mm:ss')}
                  </Text>
                  <Text fz={11} ff="monospace">
                    ended: {run.endedAt ? dayjs(run.endedAt).format('HH:mm:ss') : '—'}
                  </Text>
                  <Text fz={11} ff="monospace">
                    duration: {duration(run.startedAt, run.endedAt)}
                  </Text>
                </Timeline.Item>
              )}
            </Timeline>
          </Paper>

          {/* Sandbox output */}
          {run.error && (
            <Paper p="md" radius="md" withBorder>
              <Text fz={14} fw={600} c="red" mb="xs">Error</Text>
              <Box
                component="pre"
                fz={11}
                ff="monospace"
                p="sm"
                style={{
                  background: 'var(--mantine-color-dark-8)',
                  color: 'var(--mantine-color-red-3)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                {run.error}
              </Box>
            </Paper>
          )}

          {run.resultSummary && (
            <Paper p="md" radius="md" withBorder>
              <Text fz={14} fw={600} mb="xs">Result summary</Text>
              <Box
                component="pre"
                fz={11}
                ff="monospace"
                p="sm"
                style={{
                  background: 'var(--mantine-color-dark-8)',
                  color: 'var(--mantine-color-gray-2)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(run.resultSummary, null, 2)}
              </Box>
            </Paper>
          )}

          {/* Meta */}
          <Paper p="md" radius="md" withBorder>
            <Stack gap={4}>
              <Text fz={11} c="dimmed">Organisation: {run.organisationId}</Text>
              <Text fz={11} c="dimmed">Plugin version: {run.pluginVersionId}</Text>
              <Text fz={11} c="dimmed">Operations: {run.operationCount}</Text>
              <Text fz={11} c="dimmed">
                Created: {run.createdAt ? dayjs(run.createdAt).format('LLL') : '—'}
              </Text>
            </Stack>
          </Paper>
        </Stack>
      ) : (
        <Text c="dimmed">Run not found.</Text>
      )}
    </AppDrawer>
  )
}

// ── RunsPage component ──────────────────────────────────────────────────────

export function RunsPage() {
  const queryClient = useQueryClient()
  const stamp = useStamp()

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState<string | null>(null)
  const [tokens, setTokens] = useState<Token[]>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  // Default to newest-first, matching the server's created-desc fetch order.
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])

  // Keep polling for a short window after landing here even with no active run, so a
  // run that was just dispatched (and whose row lands a beat later, once the
  // create→outbox→runner pipeline catches up) appears on its own — no manual refresh.
  const [pollUntil] = useState(() => Date.now() + 20_000)
  const { data, isPending, isError, isFetching, refetch } = useQuery(
    pluginRunsQueryOptions({ limit: 200 }, undefined, { pollUntil }),
  )
  const runs = data?.runs ?? []
  const total = data?.total ?? 0

  const filterFields = useMemo(() => buildRunFilterFields(runs), [runs])
  const filtered = useMemo(() => filterRuns(runs, tokens), [runs, tokens])

  const onTokensChange = (next: Token[]) => {
    setTokens(next)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }
  // A sort re-orders the whole list; snap back to page 1 so the top rows show.
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting(updater)
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPluginRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runKeys.all })
      notifications.show({ color: 'green', message: 'Run cancelled' })
      setCancelPending(null)
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: `Cancel failed: ${errorMessage(error)}`,
      })
      setCancelPending(null)
    },
  })

  const retryMutation = useMutation({
    mutationFn: () => retryFailedRuns(),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: runKeys.all })
      notifications.show({
        color: 'green',
        message: `${count} failed runs requeued`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Retry failed: ${errorMessage(error)}`,
      }),
  })

  const clearMutation = useMutation({
    mutationFn: () => clearFinishedRuns(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runKeys.all })
      notifications.show({ color: 'green', message: 'Finished runs cleared' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Clear failed: ${errorMessage(error)}`,
      }),
  })

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<PluginRun>[]>(
    () => [
      {
        id: 'id',
        header: 'Run',
        accessorFn: (row) => `R-${row.id.slice(0, 6)}`,
        meta: { nowrap: true },
        cell: (info) => (
          <Text fz={12} ff="monospace" fw={600} c="dimmed">
            {info.getValue() as string}
          </Text>
        ),
      },
      {
        id: 'pluginId',
        header: 'Plugin',
        accessorFn: (row) => row.pluginId,
        meta: { grow: true },
        cell: (info) => (
          <Text fz={13} ff="monospace" c="dimmed">
            {info.getValue() as string}
          </Text>
        ),
      },
      {
        id: 'eventType',
        header: 'Event',
        accessorFn: (row) => row.eventType,
        meta: { nowrap: true },
        cell: (info) => (
          <Badge variant="light" size="sm" radius="sm">
            {info.getValue() as string}
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        meta: { nowrap: true },
        cell: (info) => <StatusBadge status={info.getValue() as PluginRunStatus} />,
      },
      {
        id: 'skipReason',
        header: 'Skip',
        accessorFn: (row) => row.skipReason,
        meta: { nowrap: true },
        cell: (info) => {
          const v = info.getValue() as string | null
          return v ? (
            <Badge variant="outline" size="xs" color="yellow">
              {v}
            </Badge>
          ) : (
            <Text fz={12} c="dimmed">—</Text>
          )
        },
      },
      {
        id: 'duration',
        header: 'Duration',
        // Sort on the numeric ms; render the formatted string from the row.
        accessorFn: (row) => durationMs(row.startedAt, row.endedAt),
        meta: { nowrap: true },
        cell: (info) => (
          <Text fz={12} ff="monospace" c="dimmed">
            {duration(info.row.original.startedAt, info.row.original.endedAt)}
          </Text>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        accessorFn: (row) => row.createdAt,
        meta: { nowrap: true },
        cell: (info) => {
          const v = info.getValue() as string | null
          return (
            <Text fz={12} c="dimmed">
              {v ? dayjs(v).fromNow() : '—'}
            </Text>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        meta: { nowrap: true },
        cell: (info) => {
          const run = info.row.original
          const isTerminal =
            run.status === 'success' ||
            run.status === 'failure' ||
            run.status === 'timeout' ||
            run.status === 'cancelled' ||
            run.status === 'skipped'
          return (
            <Button
              variant="default"
              size="xs"
              loading={cancelPending === run.id}
              onClick={(e) => {
                e.stopPropagation()
                if (isTerminal) {
                  setSelectedRunId(run.id)
                } else {
                  setCancelPending(run.id)
                  cancelMutation.mutate(run.id)
                }
              }}
            >
              {isTerminal ? 'Detail' : 'Cancel'}
            </Button>
          )
        },
      },
    ],
    [cancelMutation, cancelPending],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box className={classes.page}>
      <Group align="center" gap={14} mb={24} wrap="wrap">
        <Group align="baseline" gap={14} wrap="wrap">
          <Title order={1} size="h2">
            Plugin Runs
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {stamp}
          </Text>
        </Group>
        <Group gap={10} ml="auto" wrap="wrap">
          <Badge variant="light" color="gray" radius="sm" size="lg">
            {total} total
          </Badge>
          <Button
            variant="default"
            size="xs"
            leftSection={<RefreshCw size={14} />}
            onClick={() => refetch()}
            loading={isFetching}
          >
            Refresh
          </Button>
          <Button
            variant="default"
            size="xs"
            onClick={() => retryMutation.mutate()}
            loading={retryMutation.isPending}
          >
            Retry failed
          </Button>
          <Button
            variant="default"
            size="xs"
            onClick={() => clearMutation.mutate()}
            loading={clearMutation.isPending}
          >
            Clear finished
          </Button>
        </Group>
      </Group>

      <TablePanel
        title="Runs"
        countNoun="runs"
        count={filtered.length}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter runs — pick a field, then a value"
        tokens={tokens}
        onTokensChange={onTokensChange}
        hasActiveFilters={tokens.length > 0}
        onClearFilters={() => onTokensChange([])}
      >
        <DataTable
          table={table}
          minWidth={900}
          emptyMessage="No plugin runs match the current filters."
          isPending={isPending}
          isError={isError}
          onRetry={() => refetch()}
          onRowClick={(row) => setSelectedRunId(row.original.id)}
          loadingMessage="Loading runs…"
        />
      </TablePanel>

      <RunDetailDrawer
        runId={selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </Box>
  )
}
