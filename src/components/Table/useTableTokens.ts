import type { Token, TokenField } from '#/components/Table/TokenSearch'
import type { RowData, Table } from '@tanstack/react-table'
import { useMemo } from 'react'

type FilterField = TokenField & { columnId: string }

// Derives the active token list from column filter state (single source of
// truth) and returns a setter that pushes token edits back to the columns.
export function useTableTokens<T extends RowData>(
  table: Table<T>,
  filterFields: FilterField[],
): { tokens: Token[]; setTokens: (next: Token[]) => void } {
  const columnFilters = table.getState().columnFilters

  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = []
    for (const f of filterFields) {
      const vals =
        (table.getColumn(f.columnId)?.getFilterValue() as
          | string[]
          | undefined) ?? []
      for (const v of vals) {
        const label =
          f.kind === 'enum'
            ? (f.options?.find((o) => o.value === v)?.label ?? v)
            : v
        out.push({ field: f.key, value: v, label })
      }
    }
    return out
  }, [table, columnFilters, filterFields])

  const setTokens = (next: Token[]) => {
    for (const f of filterFields) {
      const vals = next.filter((t) => t.field === f.key).map((t) => t.value)
      table
        .getColumn(f.columnId)
        ?.setFilterValue(vals.length ? vals : undefined)
    }
  }

  return { tokens, setTokens }
}
