import type { Alert } from '#/components/Alerts/alerts.types'
import type { FilterFn, SortingFn } from '@tanstack/react-table'

// Match a single scalar cell value against the OR-list of selected values.
export const includesOne: FilterFn<Alert> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

export const includesAnyTag: FilterFn<Alert> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const tags = row.getValue<string[]>(columnId)
  return filterValue.some((t) => tags.includes(t))
}

// Free-text fields (alert number, title): cell contains any typed substring.
export const includesAnySubstring: FilterFn<Alert> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort the "Alert" column by the numeric id (e.g. "AL-9123").
export const byAlertId: SortingFn<Alert> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

// Sort "Age" chronologically by the underlying minutes.
export const byAge: SortingFn<Alert> = (a, b) =>
  a.original.ageMin - b.original.ageMin
