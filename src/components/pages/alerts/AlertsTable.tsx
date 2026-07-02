import type { Alert } from '#/components/Alerts/alerts.types'
import { Group, Table } from '@mantine/core'
import type { Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import styles from './styles.module.css'

export function AlertsTable({
  table,
  selectMode,
  onOpenAlert,
}: {
  table: ReactTable<Alert>
  selectMode: boolean
  onOpenAlert: (id: string) => void
}) {
  const rows = table.getRowModel().rows

  return (
    <Table.ScrollContainer minWidth={820}>
      <Table
        highlightOnHover
        horizontalSpacing="lg"
        verticalSpacing="sm"
        borderColor="var(--line-soft)"
      >
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const label = flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )
                return (
                  <Table.Th
                    key={header.id}
                    className={styles.columnHeader}
                    ta={meta?.ta}
                    visibleFrom={meta?.visibleFrom}
                    w={header.column.id === 'select' ? 40 : undefined}
                  >
                    {canSort ? (
                      <Group
                        gap={4}
                        wrap="nowrap"
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        {label}
                        {sorted === 'asc' ? (
                          <ChevronUp size={12} />
                        ) : sorted === 'desc' ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronsUpDown size={12} style={{ opacity: 0.4 }} />
                        )}
                      </Group>
                    ) : (
                      label
                    )}
                  </Table.Th>
                )
              })}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const isSel = row.getIsSelected()
            return (
              <Table.Tr
                key={row.id}
                bg={isSel ? 'orange.0' : undefined}
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  selectMode
                    ? row.toggleSelected()
                    : onOpenAlert(row.original.id)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    selectMode
                      ? row.toggleSelected()
                      : onOpenAlert(row.original.id)
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  const stop =
                    cell.column.id === 'select' || cell.column.id === 'actions'
                  return (
                    <Table.Td
                      key={cell.id}
                      ta={meta?.ta}
                      visibleFrom={meta?.visibleFrom}
                      onClick={stop ? (e) => e.stopPropagation() : undefined}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            )
          })}
          {rows.length === 0 && (
            <Table.Tr>
              <Table.Td
                ta="center"
                c="dimmed"
                fz={13}
                py={40}
                px={18}
                colSpan={table.getVisibleLeafColumns().length}
              >
                No alerts match the current filters.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
