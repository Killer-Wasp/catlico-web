import type { Observable } from '#/components/Observables/observables.types'
import { Button, Group, Loader, Stack, Table, Text } from '@mantine/core'
import type { Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import styles from './styles.module.css'

export function ObservablesTable({
  table,
  isPending,
  isError,
  isFetching,
  onRetry,
  onOpen,
}: {
  table: ReactTable<Observable>
  isPending: boolean
  isError: boolean
  isFetching: boolean
  onRetry: () => void
  onOpen: (observable: Observable) => void
}) {
  const rows = table.getRowModel().rows

  return (
    <Table.ScrollContainer minWidth={1080}>
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
                return (
                  <Table.Th
                    key={header.id}
                    className={styles.columnHeader}
                    ta={meta?.ta}
                    visibleFrom={meta?.visibleFrom}
                    w={header.column.id === 'select' ? 40 : undefined}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
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
                px={18}
                colSpan={table.getVisibleLeafColumns().length}
              >
                <Group justify="center" gap="xs">
                  <Loader size="xs" />
                  <Text component="span" fz={13} c="dimmed">
                    Loading observables…
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
                px={18}
                colSpan={table.getVisibleLeafColumns().length}
              >
                <Stack align="center" gap="xs">
                  <Text component="span" fz={13} c="red.7">
                    Couldn’t load observables from the backend.
                  </Text>
                  <Button
                    size="xs"
                    variant="default"
                    loading={isFetching}
                    onClick={onRetry}
                  >
                    Retry
                  </Button>
                </Stack>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => {
              const isSelected = row.getIsSelected()
              return (
                <Table.Tr
                  key={row.id}
                  bg={isSelected ? 'orange.0' : undefined}
                  tabIndex={0}
                  onClick={() => onOpen(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(row.original)
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
                        onClick={
                          cell.column.id === 'select' ||
                          cell.column.id === 'actions'
                            ? (event) => event.stopPropagation()
                            : undefined
                        }
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
            })
          )}
          {!isPending && !isError && rows.length === 0 && (
            <Table.Tr>
              <Table.Td
                ta="center"
                c="dimmed"
                fz={13}
                py={40}
                px={18}
                colSpan={table.getVisibleLeafColumns().length}
              >
                No observables match the current filters.
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
