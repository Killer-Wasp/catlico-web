import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { Button, Group, Paper, Text, Title } from '@mantine/core'
import type { TitleOrder } from '@mantine/core'
import type { RowData, Table } from '@tanstack/react-table'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import classes from './Table.module.css'
import { TableFilterBar } from './TableFilterBar'
import { TablePagination } from './TablePagination'

type FilterField = TokenField & { columnId?: string }

type TablePanelProps<T extends RowData> = {
  title: ReactNode
  /** Render the title as a semantic heading of this order (e.g. 2 → <h2>). */
  titleHeadingOrder?: TitleOrder
  /** Noun for the count pill, e.g. "cases", "alerts". */
  countNoun: string
  /** Override the count shown in the pill. Defaults to filtered/total row count. */
  count?: number
  /** Full override of the count-pill content (single node). Wins over count/countNoun. */
  countLabel?: ReactNode
  /** Extra content after the count pill in the header (e.g. custom stat text). */
  titleExtra?: ReactNode
  table: Table<T>
  /** Token filter fields; only used when the filter bar is shown. */
  filterFields?: FilterField[]
  filterPlaceholder?: string
  /** Key of the text field free-typed input searches when no field is picked. */
  filterDefaultTextField?: string
  /** Render the token filter row. Detail-page tables opt out. */
  withFilterBar?: boolean
  /** Render the pagination footer. Detail-page tables opt out. */
  withPagination?: boolean
  /** Available page-size options forwarded to TablePagination. */
  pageSizeOptions?: string[]
  /** Normal (non-select-mode) header action buttons. */
  actions?: ReactNode
  /** Header action buttons shown only while in select mode. */
  selectActions?: ReactNode
  /** Whether this table supports row multi-select mode. */
  selectable?: boolean
  selectMode?: boolean
  onToggleSelectMode?: () => void
  /** Extra elements in the filter row (between TokenSearch and Select button). */
  filterRowActions?: ReactNode
  /**
   * Controlled filter tokens. When provided, the panel drives its filter bar,
   * "Clear" button and active-filter check from these instead of the table's
   * column-filter state. Used by the cases list's clause-based filters.
   */
  tokens?: Token[]
  onTokensChange?: (tokens: Token[]) => void
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  /** The DataTable body — passed as children so each page controls its own props. */
  children: ReactNode
}

export function TablePanel<T extends RowData>({
  title,
  titleHeadingOrder,
  countNoun,
  count,
  countLabel,
  titleExtra,
  table,
  filterFields = [],
  filterPlaceholder,
  filterDefaultTextField,
  withFilterBar = true,
  withPagination = true,
  pageSizeOptions,
  actions,
  selectActions,
  selectable = false,
  selectMode = false,
  onToggleSelectMode,
  filterRowActions,
  tokens,
  onTokensChange,
  hasActiveFilters,
  onClearFilters,
  children,
}: TablePanelProps<T>) {
  const hasFilters =
    hasActiveFilters ?? table.getState().columnFilters.length > 0
  const clearFilters = onClearFilters ?? (() => table.resetColumnFilters())

  const resolvedCount =
    count ??
    (table.options.manualPagination
      ? (table.options.rowCount ?? 0)
      : table.getFilteredRowModel().rows.length)

  return (
    <Paper radius="md" p={0} withBorder>
      {/* Header row */}
      <Group
        gap={12}
        px={18}
        py={14}
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        {titleHeadingOrder ? (
          <Title order={titleHeadingOrder} fz={14} fw={600} m={0}>
            {title}
          </Title>
        ) : (
          <Text fz={14} fw={600}>
            {title}
          </Text>
        )}
        <Text
          component="span"
          className={classes.countPill}
          style={(theme) => ({
            background: `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`,
            border: `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
          })}
        >
          {countLabel ?? `${resolvedCount} ${countNoun}`}
        </Text>
        {titleExtra}
        <Group gap="xs" ml="auto">
          {selectMode && selectActions}
          {hasFilters && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<X size={14} />}
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
          {actions}
        </Group>
      </Group>

      {/* Filter row */}
      {withFilterBar && (
        <TableFilterBar
          table={table}
          filterFields={filterFields}
          placeholder={filterPlaceholder}
          defaultTextField={filterDefaultTextField}
          selectable={selectable}
          selectMode={selectMode}
          onToggleSelectMode={onToggleSelectMode}
          filterRowActions={filterRowActions}
          tokens={tokens}
          onTokensChange={onTokensChange}
        />
      )}

      {/* Table body (DataTable or custom loading/error wrapper) */}
      {children}

      {/* Pagination footer */}
      {withPagination && (
        <TablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </Paper>
  )
}
