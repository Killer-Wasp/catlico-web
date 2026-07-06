import { Group, Pagination, Select, Text } from '@mantine/core'
import type { RowData, Table } from '@tanstack/react-table'
import classes from './Table.module.css'

type TablePaginationProps<T extends RowData> = {
  table: Table<T>
  /** Available page-size options. Default: ['10','20','30']. */
  pageSizeOptions?: string[]
}

export function TablePagination<T extends RowData>({
  table,
  pageSizeOptions = ['10', '20', '30'],
}: TablePaginationProps<T>) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = Math.max(1, table.getPageCount())
  // For server-driven tables rowCount reflects total; for client-driven it's
  // the filtered row count — either way getFilteredRowModel gives the right
  // number for client tables and manual tables use rowCount directly.
  const total =
    table.options.manualPagination
      ? table.options.rowCount ?? 0
      : table.getFilteredRowModel().rows.length
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total)

  return (
    <Group
      gap={12}
      px={18}
      py={12}
      wrap="wrap"
      style={{ borderTop: '1px solid var(--line-soft)' }}
    >
      <Text component="span" ff="monospace" fz={11} c="dimmed">
        {rangeStart}-{rangeEnd} of {total}
      </Text>
      <Group gap="md" wrap="nowrap" ml="auto">
        <Group gap="xs" wrap="nowrap">
          <Text component="span" className={classes.fieldLabel}>
            rows
          </Text>
          <Select
            size="xs"
            w={76}
            data={pageSizeOptions}
            value={String(pageSize)}
            onChange={(v) =>
              table.setPagination({ pageIndex: 0, pageSize: Number(v ?? pageSizeOptions[0]) })
            }
            allowDeselect={false}
          />
        </Group>
        <Pagination.Root
          total={pageCount}
          value={pageIndex + 1}
          onChange={(p) => table.setPageIndex(p - 1)}
          size="sm"
        >
          <Group gap={5} wrap="nowrap">
            <Pagination.First />
            <Pagination.Previous />
            <Text
              component="span"
              ff="monospace"
              fz={12}
              c="var(--muted)"
              px={6}
              style={{ whiteSpace: 'nowrap' }}
            >
              {pageIndex + 1} / {pageCount}
            </Text>
            <Pagination.Next />
            <Pagination.Last />
          </Group>
        </Pagination.Root>
      </Group>
    </Group>
  )
}
