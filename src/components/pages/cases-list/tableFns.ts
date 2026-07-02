import type { Case } from '#/components/Cases/cases.types'
import type { FilterFn, SortingFn } from '@tanstack/react-table'

// MultiSelect filters hold an array of selected strings; an empty array
// means "no filter". `includesOne` matches a single scalar cell value,
// `includesAnyTag` matches when any selected tag is present on the row.
export const includesOne: FilterFn<Case> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

export const includesAnyTag: FilterFn<Case> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const tags = row.getValue<string[]>(columnId)
  return filterValue.some((t) => tags.includes(t))
}

// Free-text fields (case number, title): match when the cell contains any of
// the typed substrings, case-insensitively.
export const includesAnySubstring: FilterFn<Case> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((q) => cell.includes(q.toLowerCase()))
}

// Sort the "Case" column by the numeric case id (e.g. "#1842") rather
// than the severity its accessor carries for filtering.
export const byCaseId: SortingFn<Case> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

// "created"/"updated" are relative strings ("8m" / "1h" / "6d"); convert to
// minutes so smaller = more recent and the columns sort chronologically.
const UNIT_MIN: Record<string, number> = { m: 1, h: 60, d: 1440 }
const ageMinutes = (s: string) => {
  const m = /^(\d+)\s*([mhd])$/.exec(s.trim())
  return m ? Number(m[1]) * UNIT_MIN[m[2]] : Number.POSITIVE_INFINITY
}
export const byCreated: SortingFn<Case> = (a, b) =>
  ageMinutes(a.original.created) - ageMinutes(b.original.created)
export const byUpdated: SortingFn<Case> = (a, b) =>
  ageMinutes(a.original.updated) - ageMinutes(b.original.updated)
