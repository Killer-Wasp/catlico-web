/**
 * RunsPage — the plugin runs queue table with pagination, cancel/retry/clear,
 * and row detail drawer showing the full-stack trace.
 */

import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
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
import { DataTable } from '#/components/Table/DataTable'
import classes from '#/components/Cases/CasesPage.module.css'
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

// ── Run detail drawer ───────────────────────────────────────────────────────

function RunDetailDrawer({
  runId,
  onClose,
}: {
  runId: string | null
  onClose: () => void
}) {
  const { data: run, isPending } = useQuery(pluginRunDetailQueryOptions(runId))

  if (!runId) return null

  return (
    <Drawer
      opened={runId !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={<Title order={3} size="h4">Run {runId.slice(0, 8)}</Title>}
      padding="lg"
    >
      {isPending ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : run ? (
        <Stack gap="md">
          {/* Timeline: event → delivery → run → result */}
          <Paper p="md" radius="md" withBorder>
            <Stack gap="xs">
              <Text fz={14} fw={600}>Trace</Text>

              <Group gap="sm" wrap="nowrap">
                <Badge variant="dot" color="blue" size="sm">Event</Badge>
                <Stack gap={0}>
                  <Text fz={12}>{run.eventType}</Text>
                  <Text fz={11} c="dimmed" ff="monospace">
                    {run.eventId}
                  </Text>
                </Stack>
              </Group>

              <Group gap="sm" wrap="nowrap">
                <Badge variant="dot" color="violet" size="sm">Delivery</Badge>
                <Stack gap={0}>
                  <Text fz={12}>
                    {run.eventObjectType ?? '—'} / {run.eventObjectId ?? '—'}
                  </Text>
                  <Text fz={11} c="dimmed" ff="monospace">
                    plugin: {run.pluginId}
                  </Text>
                </Stack>
              </Group>

              <Group gap="sm" wrap="nowrap">
                <Badge variant="dot" color="orange" size="sm">Run</Badge>
                <Stack gap={0}>
                  <Text fz={12}>
                    <StatusBadge status={run.status} />{' '}
                    {run.skipReason && (
                      <Badge variant="outline" size="xs" ml={4}>
                        {run.skipReason}
                      </Badge>
                    )}
                  </Text>
                  <Text fz={11} c="dimmed" ff="monospace">
                    runner: {run.runnerId}
                  </Text>
                </Stack>
              </Group>

              {run.startedAt && (
                <Group gap="sm" wrap="nowrap">
                  <Badge variant="dot" color="gray" size="sm">Timing</Badge>
                  <Stack gap={0}>
                    <Text fz={11} ff="monospace">
                      started: {dayjs(run.startedAt).format('HH:mm:ss')}
                    </Text>
                    <Text fz={11} ff="monospace">
                      ended: {run.endedAt ? dayjs(run.endedAt).format('HH:mm:ss') : '—'}
                    </Text>
                    <Text fz={11} ff="monospace">
                      duration: {duration(run.startedAt, run.endedAt)}
                    </Text>
                  </Stack>
                </Group>
              )}
            </Stack>
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
    </Drawer>
  )
}

// ── RunsPage component ──────────────────────────────────────────────────────

export function RunsPage() {
  const queryClient = useQueryClient()
  const stamp = useStamp()

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [cancelPending, setCancelPending] = useState<string | null>(null)

  const { data, isPending, isError, refetch } = useQuery(
    pluginRunsQueryOptions({ limit: 200 }),
  )
  const runs = data?.runs ?? []
  const total = data?.total ?? 0

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
        accessorFn: (row) => duration(row.startedAt, row.endedAt),
        meta: { nowrap: true },
        cell: (info) => (
          <Text fz={12} ff="monospace" c="dimmed">
            {info.getValue() as string}
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
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
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

      <DataTable
        table={table}
        minWidth={900}
        emptyMessage="No plugin runs found."
        isPending={isPending}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => setSelectedRunId(row.original.id)}
        loadingMessage="Loading runs…"
      />

      <RunDetailDrawer
        runId={selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </Box>
  )
}
