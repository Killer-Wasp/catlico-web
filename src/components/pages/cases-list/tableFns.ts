import type { Case } from '#/components/Cases/cases.types'
import type { SortingFn } from '@tanstack/react-table'

// Sort the "Case" column by the numeric case id (e.g. "#1842") rather
// than the severity its accessor carries for filtering.
export const byCaseId: SortingFn<Case> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

export const byCreated: SortingFn<Case> = (a, b) =>
  new Date(b.original.createdAt).getTime() -
  new Date(a.original.createdAt).getTime()
export const byUpdated: SortingFn<Case> = (a, b) =>
  new Date(b.original.updatedAt).getTime() -
  new Date(a.original.updatedAt).getTime()
