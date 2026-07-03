import classes from '#/components/Cases/CasesPage.module.css'
import { DataTable } from '#/components/Table/DataTable'
import { TablePagination } from '#/components/Table/TablePagination'
import { Box, Button, Text } from '@mantine/core'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { buildFunctionColumns } from './functionColumns'
import type { FunctionAutomation } from './model'
import { FuncPanel, PageHead } from './Panels'

export function FunctionsList({
  functions,
  onEdit,
  onNew,
  onToggle,
  loading,
}: {
  functions: FunctionAutomation[]
  onEdit: (fn: FunctionAutomation) => void
  onNew: () => void
  onToggle: (id: number, enabled: boolean) => void
  loading: boolean
}) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const columns = useMemo(() => buildFunctionColumns({ onToggle }), [onToggle])

  const table = useReactTable({
    data: functions,
    columns,
    state: { pagination },
    getRowId: (row) => String(row.id),
    enableSorting: false,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <Box className={classes.page}>
      <PageHead
        title="Functions"
        stamp="automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile"
        actions={
          <Button variant="default" onClick={onNew}>
            + New function
          </Button>
        }
      />

      <FuncPanel
        title="All functions"
        badge={`${functions.length} functions`}
        right={
          <Text ff="monospace" fz="xs" c="dimmed">
            click a function to edit
          </Text>
        }
      >
        <DataTable
          table={table}
          minWidth={900}
          verticalSpacing="md"
          emptyMessage="No functions yet. Create one to get started."
          isPending={loading}
          loadingMessage="Loading functions..."
          stopPropagationColumnIds={['enabled']}
          onRowClick={(row) => onEdit(row.original)}
        />
        <TablePagination table={table} />
      </FuncPanel>
    </Box>
  )
}
