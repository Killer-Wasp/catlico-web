import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { Button, Stack, Text } from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Plus } from 'lucide-react'

type CustomField = CaseDetail['customFields'][number]

const COLUMNS: ColumnDef<CustomField>[] = [
  {
    id: 'field',
    header: 'Field',
    meta: { nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) => <Text fw={600}>{row.original[0]}</Text>,
  },
  {
    id: 'value',
    header: 'Value',
    meta: { grow: true } satisfies TableColumnMeta,
    cell: ({ row }) => <Text>{row.original[1]}</Text>,
  },
]

export function CustomFieldsPanel({
  customFields,
}: {
  customFields: CaseDetail['customFields']
}) {
  const table = useReactTable({
    data: customFields,
    columns: COLUMNS,
    getRowId: (row) => row[0],
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Stack gap="md" p="lg">
      <TablePanel
        title="Custom fields"
        countNoun="fields"
        table={table}
        withFilterBar={false}
        withPagination={false}
        actions={
          <Button variant="default" size="xs" leftSection={<Plus size={14} />}>
            Add Custom field
          </Button>
        }
      >
        <DataTable
          table={table}
          minWidth={420}
          ariaLabel="Case custom fields"
          emptyMessage="No custom fields for this case."
        />
      </TablePanel>
    </Stack>
  )
}
