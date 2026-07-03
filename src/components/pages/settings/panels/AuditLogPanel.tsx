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
  LoadingPanel,
  Panel,
} from '#/components/pages/settings/settingsUi'

export function AuditLogPanel() {
  const { data, isPending } = useQuery(auditsQueryOptions())
  const items = data?.items ?? []

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
        id: 'org',
        header: 'Org',
        cell: ({ row }) => <Code>{row.original.context_id ?? '—'}</Code>,
      },
    ],
    [],
  )

  if (isPending) return <LoadingPanel label="Loading audit log..." />

  return (
    <Panel
      title="Audit log"
      count={`${data?.total ?? items.length} events`}
      action={
        <Button
          variant="default"
          onClick={() => {
            // ponytail: client-side CSV export; proper server export if needed
            const header = 'Time,Actor,Action,Entity,Object,Org\n'
            const rows = items
              .map(
                (r) =>
                  `${r.created_at},${r.actor},${r.action},${r.object_type},${r.object_id},${r.context_id ?? ''}`,
              )
              .join('\n')
            const blob = new Blob([header + rows], {
              type: 'text/csv',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'audit-log.csv'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Export CSV
        </Button>
      }
    >
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
