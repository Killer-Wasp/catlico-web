import type { Task } from '#/components/Tasks/tasks.types'
import type { FilterFn, SortingFn } from '@tanstack/react-table'

// Match a single scalar cell value against the OR-list of selected values.
export const includesOne: FilterFn<Task> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

// Free-text fields (case number, title): cell contains any typed substring.
export const includesAnySubstring: FilterFn<Task> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort by the numeric case id the task hangs off (e.g. "#1842").
export const byCaseId: SortingFn<Task> = (a, b) =>
  Number(a.original.caseId.replace(/\D/g, '')) -
  Number(b.original.caseId.replace(/\D/g, ''))

export const byDueDate: SortingFn<Task> = (a, b) => {
  const aTime = a.original.dueAt
    ? new Date(a.original.dueAt).getTime()
    : Infinity
  const bTime = b.original.dueAt
    ? new Date(b.original.dueAt).getTime()
    : Infinity
  return aTime - bTime
}
