import { Button, Code, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import { auditsQueryOptions } from '#/components/pages/settings/settingsQueries'
import type { AuditPublic } from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  ErrorPanel,
  LoadingPanel,
  Panel,
} from '#/components/pages/settings/settingsUi'

// Quote a value for CSV: escape embedded quotes and neutralise leading characters
// that spreadsheet apps would interpret as a formula (CSV injection).
export function csvField(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function exportAuditCsv(items: AuditPublic[]) {
  const header = ['Time', 'Actor', 'Action', 'Entity', 'Object', 'Context']
  const rows = items.map((r) =>
    [
      r.created_at,
      r.actor,
      r.action,
      r.object_type,
      r.object_id,
      r.context_id ?? '',
    ]
      .map(csvField)
      .join(','),
  )
  const csv = [header.map(csvField).join(','), ...rows].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'audit-log.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditLogPanel() {
  const { data, isPending, isError, refetch, isFetching } =
    useQuery(auditsQueryOptions())
  const items = data?.items ?? []
  const total = data?.total ?? items.length
  const truncated = total > items.length

  const columns = useMemo<ColumnDef<AuditPublic>[]>(
    () => [
      {
        id: 'time',
        header: 'Time',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {compactDate(row.original.created_at)}
          </Text>
        ),
      },
      { id: 'actor', header: 'Actor', accessorFn: (row) => row.actor },
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => <Code>{row.original.action}</Code>,
      },
      { id: 'entity', header: 'Entity', accessorFn: (row) => row.object_type },
      {
        id: 'object',
        header: 'Object',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {row.original.object_id}
          </Text>
        ),
      },
      {
        id: 'context',
        header: 'Context',
        cell: ({ row }) => <Code>{row.original.context_id ?? '—'}</Code>,
      },
    ],
    [],
  )

  if (isPending) return <LoadingPanel label="Loading audit log..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load the audit log. It requires platform administrator access."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <Panel
      title="Audit log"
      count={`${total} events`}
      action={
        <Button
          variant="default"
          disabled={items.length === 0}
          onClick={() => exportAuditCsv(items)}
        >
          Export CSV
        </Button>
      }
    >
      {truncated && (
        <Text c="dimmed" fz={12} px={18} pt={12}>
          Showing (and exporting) the most recent {items.length} of {total}{' '}
          events.
        </Text>
      )}
      <AuditTable columns={columns} items={items} />
    </Panel>
  )
}

function AuditTable({
  columns,
  items,
}: {
  columns: ColumnDef<AuditPublic>[]
  items: AuditPublic[]
}) {
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={900}
      ariaLabel="Audit log"
      emptyMessage="No audit events found."
    />
  )
}
