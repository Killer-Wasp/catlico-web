import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  slaPoliciesQueryOptions,
  settingsKeys,
  upsertSlaPolicies,
} from '#/components/pages/settings/settingsQueries'
import type { SlaPolicyUpsertInput } from '#/components/pages/settings/settingsQueries'
import { LoadingPanel, Panel } from '#/components/pages/settings/settingsUi'

const SEVERITY_LABELS: Record<number, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: 'gray',
  2: 'orange.7',
  3: 'red.7',
  4: 'red.9',
}

type EditableRow = {
  severity: number
  ack: string
  resolve: string
  escalate: string
  enabled: boolean
}

function secondsToCompact(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

function compactToSeconds(v: string): number {
  const m = /^(\d+)\s*(m|h|d)$/i.exec(v.trim())
  if (!m) return 0
  const n = Number(m[1])
  switch (m[2].toLowerCase()) {
    case 'm': return n * 60
    case 'h': return n * 3600
    case 'd': return n * 86400
    default: return 0
  }
}

export function SlaPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(slaPoliciesQueryOptions())
  const [rows, setRows] = useState<EditableRow[]>([])

  const policies = data?.items ?? []

  useEffect(() => {
    if (!policies.length) return
    setRows(
      policies.map((p) => ({
        severity: p.severity,
        ack: secondsToCompact(p.ack_seconds),
        resolve: secondsToCompact(p.resolve_seconds),
        escalate: p.escalation_target,
        enabled: p.enabled,
      })),
    )
  }, [policies.length])

  const saveMutation = useMutation({
    mutationFn: (input: SlaPolicyUpsertInput[]) => upsertSlaPolicies(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'SLA policies saved' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to save SLA policies',
      }),
  })

  const handleSave = () => {
    const input: SlaPolicyUpsertInput[] = rows.map((r) => ({
      severity: r.severity,
      ack_seconds: compactToSeconds(r.ack),
      resolve_seconds: compactToSeconds(r.resolve),
      escalation_target: r.escalate,
      enabled: r.enabled,
    }))
    saveMutation.mutate(input)
  }

  const setRow = (severity: number, patch: Partial<EditableRow>) => {
    setRows((current) =>
      current.map((r) => (r.severity === severity ? { ...r, ...patch } : r)),
    )
  }

  const columns = useMemo<ColumnDef<EditableRow>[]>(
    () => [
      {
        id: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Text
            ff="monospace"
            fw={700}
            c={SEVERITY_COLORS[row.original.severity] ?? 'gray'}
          >
            {SEVERITY_LABELS[row.original.severity] ?? row.original.severity}
          </Text>
        ),
      },
      {
        id: 'ack',
        header: 'Time to acknowledge',
        cell: ({ row }) => (
          <TextInput
            aria-label={`${SEVERITY_LABELS[row.original.severity]} time to acknowledge`}
            value={row.original.ack}
            w={100}
            onChange={(e) =>
              setRow(row.original.severity, { ack: e.currentTarget.value })
            }
          />
        ),
      },
      {
        id: 'resolve',
        header: 'Time to resolve',
        cell: ({ row }) => (
          <TextInput
            aria-label={`${SEVERITY_LABELS[row.original.severity]} time to resolve`}
            value={row.original.resolve}
            w={100}
            onChange={(e) =>
              setRow(row.original.severity, { resolve: e.currentTarget.value })
            }
          />
        ),
      },
      {
        id: 'escalate',
        header: 'Escalate to',
        cell: ({ row }) => (
          <Select
            data={['On-call lead', 'CISO', 'Queue']}
            value={row.original.escalate}
            allowDeselect={false}
            w={180}
            aria-label={`${SEVERITY_LABELS[row.original.severity]} escalation`}
            onChange={(v) =>
              setRow(row.original.severity, { escalate: v ?? '' })
            }
          />
        ),
      },
    ],
    [],
  )

  if (isPending) return <LoadingPanel label="Loading SLA policies..." />

  if (isError) {
    return (
      <Panel title="SLA policies">
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load SLA policies.</Text>
          <Button variant="default" loading={isFetching} onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Panel>
    )
  }

  return (
    <Panel title="SLA policies" count="per severity">
      <SlaTable columns={columns} rows={rows} />
      <Group justify="flex-end" p={18} pt={0}>
        <Button color="orange" loading={saveMutation.isPending} onClick={handleSave}>
          Save SLA policies
        </Button>
      </Group>
    </Panel>
  )
}

function SlaTable({
  columns,
  rows,
}: {
  columns: ColumnDef<EditableRow>[]
  rows: EditableRow[]
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => String(row.severity),
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={640}
      ariaLabel="SLA policies"
      emptyMessage="No SLA policies configured."
    />
  )
}
