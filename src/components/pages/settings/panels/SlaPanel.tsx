import { Button, Group, Select, Switch, Text, TextInput } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  slaPoliciesQueryOptions,
  settingsKeys,
  upsertSlaPolicies,
} from '#/components/pages/settings/settingsQueries'
import type {
  SlaPolicyPublic,
  SlaPolicyUpsertInput,
} from '#/components/pages/settings/settingsQueries'
import {
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

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

const UNIT_SECONDS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 }

// Losslessly render whole seconds as a compound duration (e.g. 5400 -> "1h30m").
// Round-tripping through `parseDuration` returns the exact same number, so saving
// never mutates a value the user did not touch.
export function secondsToCompact(total: number): string {
  if (total <= 0) return '0m'
  const parts: string[] = []
  let remaining = total
  for (const unit of ['d', 'h', 'm', 's'] as const) {
    const size = UNIT_SECONDS[unit]
    const n = Math.floor(remaining / size)
    if (n > 0) parts.push(`${n}${unit}`)
    remaining -= n * size
  }
  return parts.join('') || '0m'
}

// Parse a compound duration ("30m", "1h", "1h30m", "2d4h") to seconds. Returns
// null for anything unparseable, empty, or non-positive, so callers can reject it
// instead of silently saving a 0-second (instant-breach) SLA.
export function parseDuration(value: string): number | null {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, '')
  if (!cleaned) return null
  const re = /(\d+)(d|h|m|s)/g
  let total = 0
  let consumed = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(cleaned)) !== null) {
    consumed += match[0].length
    total += Number(match[1]) * UNIT_SECONDS[match[2]]
  }
  // Reject leftover characters (e.g. "1h5", "abc") — the whole string must parse.
  if (consumed !== cleaned.length) return null
  return total > 0 ? total : null
}

export function SlaPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    slaPoliciesQueryOptions(),
  )
  const [rows, setRows] = useState<EditableRow[]>([])
  // Seed local edit state once from the server, then again after our own saves.
  // Guarding on a ref avoids clobbering in-progress edits on background refetches.
  const seededRef = useRef(false)

  const seedRows = (policies: SlaPolicyPublic[]) => {
    setRows(
      policies.map((p) => ({
        severity: p.severity,
        ack: secondsToCompact(p.ack_seconds),
        resolve: secondsToCompact(p.resolve_seconds),
        escalate: p.escalation_target,
        enabled: p.enabled,
      })),
    )
  }

  useEffect(() => {
    if (seededRef.current || !data) return
    seededRef.current = true
    seedRows(data.items)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (input: SlaPolicyUpsertInput[]) => upsertSlaPolicies(input),
    onSuccess: (saved) => {
      // Prefix match so any active-org SLA query is refreshed regardless of id.
      queryClient.invalidateQueries({
        queryKey: [...settingsKeys.all, 'sla-policies'],
      })
      seedRows(saved)
      notifySuccess('SLA policies saved')
    },
    onError: (error) => notifyError(error, 'Failed to save SLA policies'),
  })

  const handleSave = () => {
    const input: SlaPolicyUpsertInput[] = []
    for (const r of rows) {
      const ack = parseDuration(r.ack)
      const resolve = parseDuration(r.resolve)
      if (ack === null || resolve === null) {
        notifyError(
          null,
          `Enter valid durations for ${SEVERITY_LABELS[r.severity] ?? r.severity} (e.g. 30m, 1h, 1h30m).`,
        )
        return
      }
      input.push({
        severity: r.severity,
        ack_seconds: ack,
        resolve_seconds: resolve,
        escalation_target: r.escalate,
        enabled: r.enabled,
      })
    }
    saveMutation.mutate(input)
  }

  const setRow = (severity: number, patch: Partial<EditableRow>) => {
    setRows((current) =>
      current.map((r) => (r.severity === severity ? { ...r, ...patch } : r)),
    )
  }

  const addPolicy = () => {
    const existing = new Set(rows.map((row) => row.severity))
    const severity = [1, 2, 3, 4].find((value) => !existing.has(value))
    if (!severity) return
    setRows((current) => [
      ...current,
      {
        severity,
        ack: '30m',
        resolve: '4h',
        escalate: 'Queue',
        enabled: true,
      },
    ])
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
            w={110}
            error={
              parseDuration(row.original.ack) === null &&
              row.original.ack !== ''
                ? 'e.g. 1h30m'
                : undefined
            }
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
            w={110}
            error={
              parseDuration(row.original.resolve) === null &&
              row.original.resolve !== ''
                ? 'e.g. 1h30m'
                : undefined
            }
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
      {
        id: 'enabled',
        header: 'Enabled',
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            aria-label={`${SEVERITY_LABELS[row.original.severity]} enabled`}
            onChange={(e) =>
              setRow(row.original.severity, {
                enabled: e.currentTarget.checked,
              })
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
      <ErrorPanel
        label="Couldn't load SLA policies."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <Panel
      title="SLA policies"
      count="per severity"
      action={
        <Button
          variant="default"
          onClick={addPolicy}
          disabled={rows.length >= 4}
        >
          Add SLA policy
        </Button>
      }
    >
      <SlaTable columns={columns} rows={rows} />
      <Group justify="flex-end" p={18} pt={0}>
        <Text ff="monospace" fz={11} c="var(--faint)" mr="auto">
          durations accept m / h / d, e.g. 30m or 1h30m
        </Text>
        <Button
          color="orange"
          loading={saveMutation.isPending}
          onClick={handleSave}
        >
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
      minWidth={720}
      ariaLabel="SLA policies"
      emptyMessage="No SLA policies configured."
    />
  )
}
