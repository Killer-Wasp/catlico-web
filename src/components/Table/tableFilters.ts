import type { Row } from '@tanstack/react-table'

// Shared TanStack column filter fns for the list tables. They are written as
// generic functions (rather than annotated `FilterFn<T>`) so they slot into
// any `ColumnDef<T>['filterFn']` — TS instantiates the row type at each use.
//
// MultiSelect filters hold an array of selected strings; an empty array means
// "no filter".

// Match a single scalar cell value against the OR-list of selected values.
export function includesOne<T>(
  row: Row<T>,
  columnId: string,
  filterValue: string[],
): boolean {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

// Match when any element of an array-valued cell is in the filter list
// (tags, flags, …).
export function includesAnyTag<T>(
  row: Row<T>,
  columnId: string,
  filterValue: string[],
): boolean {
  if (!filterValue.length) return true
  const values = row.getValue<string[]>(columnId)
  return filterValue.some((v) => values.includes(v))
}

// Free-text fields: cell contains any of the typed substrings, case-insensitively.
export function includesAnySubstring<T>(
  row: Row<T>,
  columnId: string,
  filterValue: string[],
): boolean {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}
