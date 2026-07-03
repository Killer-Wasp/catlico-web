import type { Case } from '#/components/Cases/cases.types'
import type { SortingFn } from '@tanstack/react-table'

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
