import type { Token, TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import { Button, Group, Text } from '@mantine/core'
import type { RowData, Table } from '@tanstack/react-table'
import { ListChecks } from 'lucide-react'
import classes from './Table.module.css'
import { useTableTokens } from './useTableTokens'

type FilterField = TokenField & { columnId?: string }

type TableFilterBarProps<T extends RowData> = {
  table: Table<T>
  filterFields: FilterField[]
  placeholder?: string
  selectable?: boolean
  selectMode?: boolean
  onToggleSelectMode?: () => void
  /** Extra content appended after the Select button (e.g. in-select-mode actions). */
  filterRowActions?: React.ReactNode
  /**
   * Controlled token override. When provided, the bar reports/reads tokens
   * through these instead of the table's column-filter state — used by pages
   * (e.g. cases) that track filters as an operator-aware clause list.
   */
  tokens?: Token[]
  onTokensChange?: (tokens: Token[]) => void
}

export function TableFilterBar<T extends RowData>({
  table,
  filterFields,
  placeholder,
  selectable = false,
  selectMode = false,
  onToggleSelectMode,
  filterRowActions,
  tokens: externalTokens,
  onTokensChange,
}: TableFilterBarProps<T>) {
  // Always call the hook (rules of hooks); prefer the controlled override.
  const derived = useTableTokens(
    table,
    filterFields.filter(
      (f): f is TokenField & { columnId: string } => f.columnId != null,
    ),
  )
  const tokens = externalTokens ?? derived.tokens
  const setTokens = onTokensChange ?? derived.setTokens
  const selectedCount = selectable
    ? table.getSelectedRowModel().rows.length
    : 0

  return (
    <Group
      px="lg"
      py="sm"
      gap="md"
      wrap="nowrap"
      align="center"
      style={{ borderBottom: '1px solid var(--line-soft)' }}
    >
      <Text component="span" className={classes.fieldLabel}>
        filter
      </Text>
      <TokenSearch
        fields={filterFields}
        tokens={tokens}
        onChange={setTokens}
        placeholder={placeholder}
      />
      {filterRowActions}
      {selectable && (
        <Button
          variant="default"
          size="xs"
          leftSection={!selectMode ? <ListChecks size={14} /> : undefined}
          onClick={onToggleSelectMode}
          aria-pressed={selectMode}
        >
          {selectMode
            ? `Cancel${selectedCount ? ` (${selectedCount})` : ''}`
            : 'Select'}
        </Button>
      )}
    </Group>
  )
}
