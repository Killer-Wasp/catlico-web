/**
 * RunnersPage — super-admin page for managing plugin runners.
 *
 * Table: name, status chip (healthy/unhealthy/offline), version, isolation
 * mode, last heartbeat, with per-row health-check / sync actions.
 *
 * Runners self-register with the shared secret on startup and appear here once
 * they do — there is no admin add/enroll flow.
 */

import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'

import type { PluginRunner } from '#/components/Plugins/plugins.types'
import {
  pluginRunnersQueryOptions,
  triggerHealthCheck,
  triggerSync,
  runnerKeys,
} from '#/components/Plugins/pluginRunners'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { Token } from '#/components/Table/TokenSearch'
import classes from '#/components/Cases/CasesPage.module.css'
import { buildRunnerFilterFields, filterRunners } from './runnerFilterSearch'
import { useStamp, errorMessage } from '#/lib/ui-helpers'

// ── Health dot ──────────────────────────────────────────────────────────────

function HealthDot({ status }: { status: string }) {
  const color =
    status === 'healthy' ? 'green' : status === 'unhealthy' ? 'orange' : 'gray'
  return <Badge variant="dot" color={color}>{status}</Badge>
}

// ── RunnersPage component ───────────────────────────────────────────────────

export function RunnersPage() {
  const queryClient = useQueryClient()
  const stamp = useStamp()

  const { data: runners = [], isPending, isError, refetch } = useQuery(pluginRunnersQueryOptions())

  const [tokens, setTokens] = useState<Token[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const filterFields = useMemo(
    () => buildRunnerFilterFields(runners),
    [runners],
  )
  const filtered = useMemo(
    () => filterRunners(runners, tokens),
    [runners, tokens],
  )

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

  const healthCheckMutation = useMutation({
    mutationFn: (id: string) => triggerHealthCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runnerKeys.list() })
      notifications.show({ color: 'green', message: 'Health check triggered' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Health check failed: ${errorMessage(error)}`,
      }),
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => triggerSync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runnerKeys.list() })
      notifications.show({ color: 'green', message: 'Sync triggered' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Sync failed: ${errorMessage(error)}`,
      }),
  })

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<PluginRunner>[]>(
    () => [
      {
        id: 'name',
        header: 'Runner',
        accessorFn: (row) => row.name,
        meta: { grow: true },
        cell: (info) => {
          const r = info.row.original
          return (
            <Stack gap={0}>
              <Text fz={14} fw={600}>{r.name}</Text>
              <Text fz={11} c="dimmed" ff="monospace">{r.id}</Text>
            </Stack>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        meta: { nowrap: true },
        cell: (info) => <HealthDot status={info.getValue() as string} />,
      },
      {
        id: 'version',
        header: 'Version',
        accessorFn: (row) => row.version || '—',
        meta: { nowrap: true },
        cell: (info) => (
          <Text fz={13} ff="monospace" c="dimmed">
            {info.getValue() as string}
          </Text>
        ),
      },
      {
        id: 'isolation',
        header: 'Isolation',
        accessorFn: (row) => row.isolationMode,
        meta: { nowrap: true },
        cell: (info) => (
          <Badge variant="outline" size="sm" radius="sm">
            {info.getValue() as string}
          </Badge>
        ),
      },
      {
        id: 'lastHeartbeat',
        header: 'Last heartbeat',
        accessorFn: (row) => row.lastHeartbeatAt,
        meta: { nowrap: true },
        cell: (info) => {
          const v = info.getValue() as string | null
          if (!v) return <Text fz={12} c="dimmed">—</Text>
          return (
            <Text fz={12} ff="monospace" c="dimmed">
              {dayjs(v).fromNow()}
            </Text>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        meta: { nowrap: true },
        cell: (info) => (
          <Group gap={6} justify="flex-end">
            <Button
              variant="default"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                healthCheckMutation.mutate(info.row.original.id)
              }}
              loading={healthCheckMutation.isPending}
            >
              Health
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                syncMutation.mutate(info.row.original.id)
              }}
              loading={syncMutation.isPending}
            >
              Sync
            </Button>
          </Group>
        ),
      },
    ],
    [healthCheckMutation, syncMutation],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange: setPagination,
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
            Plugin Runners
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {stamp}
          </Text>
        </Group>
        <Group gap={10} ml="auto" wrap="wrap">
          <Button
            variant="default"
            leftSection={<RefreshCw size={16} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <TablePanel
        title="Runners"
        countNoun="runners"
        count={filtered.length}
        table={table}
        filterFields={filterFields}
        filterPlaceholder="Filter runners — search name or ID, or pick a field"
        filterDefaultTextField="name"
        tokens={tokens}
        onTokensChange={onTokensChange}
        hasActiveFilters={tokens.length > 0}
        onClearFilters={() => onTokensChange([])}
      >
        <DataTable
          table={table}
          minWidth={900}
          emptyMessage={
            tokens.length
              ? 'No plugin runners match the current filters.'
              : 'No plugin runners registered. Runners appear here once they self-register with the shared secret.'
          }
          isPending={isPending}
          isError={isError}
          onRetry={() => refetch()}
          loadingMessage="Loading runners…"
        />
      </TablePanel>
    </Box>
  )
}
