import type { Task } from '#/components/Tasks/tasks.types'
import type { SortingFn } from '@tanstack/react-table'

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
