import type { Task } from '#/components/Tasks/tasks.types'
import { Button, Group, Loader, Table, Text } from '@mantine/core'
import type { Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import styles from './styles.module.css'

export function TasksTable({
  table,
  isPending,
  isError,
  isFetching,
  onRetry,
  onOpenCase,
}: {
  table: ReactTable<Task>
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  onOpenCase: (caseId: string) => void
}) {
  const rows = table.getRowModel().rows

  return (
    <Table.ScrollContainer minWidth={1120}>
      <Table
        highlightOnHover
        horizontalSpacing="lg"
        verticalSpacing="md"
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
                    w={header.column.id === 'complete' ? 40 : undefined}
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
          {isPending ? (
            <Table.Tr>
              <Table.Td
                ta="center"
                c="dimmed"
                fz={13}
                py={40}
                colSpan={table.getVisibleLeafColumns().length}
              >
                <Group justify="center" gap="xs">
                  <Loader size="xs" />
                  <Text component="span" fz={13} c="dimmed">
                    Loading tasks…
                  </Text>
                </Group>
              </Table.Td>
            </Table.Tr>
          ) : isError ? (
            <Table.Tr>
              <Table.Td
                ta="center"
                c="red.7"
                fz={13}
                py={40}
                colSpan={table.getVisibleLeafColumns().length}
              >
                <Group justify="center" gap="xs">
                  <Text component="span" fz={13} c="red.7">
                    Couldn’t load tasks from the backend.
                  </Text>
                  <Button
                    size="xs"
                    variant="default"
                    loading={isFetching}
                    onClick={onRetry}
                  >
                    Retry
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr
                key={row.id}
                tabIndex={0}
                onClick={() => onOpenCase(row.original.caseId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onOpenCase(row.original.caseId)
                }}
                style={{ cursor: 'pointer' }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <Table.Td
                      key={cell.id}
                      ta={meta?.ta}
                      visibleFrom={meta?.visibleFrom}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))
          )}
          {!isPending && !isError && rows.length === 0 && (
            <Table.Tr>
              <Table.Td
                ta="center"
                c="dimmed"
                fz={13}
                py={40}
                colSpan={table.getVisibleLeafColumns().length}
              >
                No tasks match the current filters.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
