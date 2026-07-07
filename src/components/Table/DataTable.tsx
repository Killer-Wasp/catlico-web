import { Button, Group, Loader, Stack, Table, Text } from '@mantine/core'
import type { Row, RowData, Table as ReactTable } from '@tanstack/react-table'
import { flexRender } from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import type { CSSProperties } from 'react'
import classes from './Table.module.css'

type DataTableProps<T extends RowData> = {
  table: ReactTable<T>
  minWidth: number
  emptyMessage: string
  onRowClick?: (row: Row<T>) => void
  verticalSpacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  isFetching?: boolean
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
  loadingMessage?: string
  errorMessage?: string
  /** Column id that receives `w={40}` (the checkbox column). Default: 'select'. */
  selectColumnId?: string
  /** Column ids whose cells stop click propagation. Default: ['select','actions']. */
  stopPropagationColumnIds?: string[]
  /** Accessible name for the `<table>` element. */
  ariaLabel?: string
}

export function DataTable<T extends RowData>({
  table,
  minWidth,
  emptyMessage,
  onRowClick,
  verticalSpacing = 'sm',
  isFetching = false,
  isPending = false,
  isError = false,
  onRetry,
  loadingMessage = 'Loading…',
  errorMessage = 'Failed to load data.',
  selectColumnId = 'select',
  stopPropagationColumnIds = ['select', 'actions'],
  ariaLabel,
}: DataTableProps<T>) {
  const rows = table.getRowModel().rows
  const colSpan = table.getVisibleLeafColumns().length
  const getColumnStyle = (
    columnId: string,
    meta: { compact?: boolean; grow?: boolean; nowrap?: boolean } | undefined,
  ): CSSProperties => {
    const compactStyle: CSSProperties = meta?.compact
      ? { paddingInline: '0.5rem' }
      : {}

    if (columnId === selectColumnId) {
      return { width: 40, whiteSpace: 'nowrap', ...compactStyle }
    }
    if (meta?.grow) {
      return { width: 'auto' }
    }
    if (meta?.nowrap) {
      return {
        width: 'max-content',
        whiteSpace: 'nowrap',
        ...compactStyle,
      }
    }
    return {}
  }

  return (
    <Table.ScrollContainer minWidth={minWidth}>
      <Table
        aria-label={ariaLabel}
        className={classes.dataTable}
        highlightOnHover
        horizontalSpacing="lg"
        verticalSpacing={verticalSpacing}
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
                    className={classes.columnHeader}
                    ta={meta?.ta}
                    visibleFrom={meta?.visibleFrom}
                    style={getColumnStyle(header.column.id, meta)}
                    w={header.column.id === selectColumnId ? 40 : undefined}
                  >
                    <Group
                      gap={4}
                      wrap="nowrap"
                      justify={meta?.ta === 'center' ? 'center' : undefined}
                      className={classes.headerContent}
                    >
                      {canSort ? (
                        <Group
                          gap={4}
                          wrap="nowrap"
                          justify={meta?.ta === 'center' ? 'center' : undefined}
                          onClick={header.column.getToggleSortingHandler()}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          {label}
                          {sorted === 'asc' ? (
                            <ChevronUp size={12} />
                          ) : sorted === 'desc' ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronsUpDown
                              size={12}
                              style={{ opacity: 0.4 }}
                            />
                          )}
                        </Group>
                      ) : (
                        label
                      )}
                    </Group>
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
                colSpan={colSpan}
              >
                <Group justify="center" gap="xs">
                  <Loader size="xs" />
                  <Text component="span" fz={13} c="dimmed">
                    {loadingMessage}
                  </Text>
                </Group>
              </Table.Td>
            </Table.Tr>
          ) : isError ? (
            <Table.Tr>
              <Table.Td ta="center" fz={13} py={40} px={18} colSpan={colSpan}>
                <Stack align="center" gap="xs">
                  <Text component="span" fz={13} c="red.7">
                    {errorMessage}
                  </Text>
                  {onRetry && (
                    <Button
                      size="xs"
                      variant="default"
                      loading={isFetching}
                      onClick={onRetry}
                    >
                      Retry
                    </Button>
                  )}
                </Stack>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => {
              const isSel = row.getIsSelected()
              // Rows are only interactive (clickable/keyboard-focusable) when a
              // click handler is supplied — settings CRUD tables pass none.
              const clickable = Boolean(onRowClick)
              return (
                <Table.Tr
                  key={row.id}
                  bg={isSel ? 'orange.0' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  style={clickable ? { cursor: 'pointer' } : undefined}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter') onRowClick?.(row)
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta
                    return (
                      <Table.Td
                        key={cell.id}
                        ta={meta?.ta}
                        visibleFrom={meta?.visibleFrom}
                        style={getColumnStyle(cell.column.id, meta)}
                        onClick={
                          stopPropagationColumnIds.includes(cell.column.id)
                            ? (e) => e.stopPropagation()
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
                colSpan={colSpan}
              >
                {emptyMessage}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
