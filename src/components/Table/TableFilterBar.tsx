import type { TokenField } from '#/components/Table/TokenSearch'
import { TokenSearch } from '#/components/Table/TokenSearch'
import { Button, Group, Text } from '@mantine/core'
import type { RowData, Table } from '@tanstack/react-table'
import { ListChecks } from 'lucide-react'
import classes from './Table.module.css'
import { useTableTokens } from './useTableTokens'

type FilterField = TokenField & { columnId: string }

type TableFilterBarProps<T extends RowData> = {
  table: Table<T>
  filterFields: FilterField[]
  placeholder?: string
  selectable?: boolean
  selectMode?: boolean
  onToggleSelectMode?: () => void
  /** Extra content appended after the Select button (e.g. in-select-mode actions). */
  filterRowActions?: React.ReactNode
}

export function TableFilterBar<T extends RowData>({
  table,
  filterFields,
  placeholder,
  selectable = false,
  selectMode = false,
  onToggleSelectMode,
  filterRowActions,
}: TableFilterBarProps<T>) {
  const { tokens, setTokens } = useTableTokens(table, filterFields)
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
