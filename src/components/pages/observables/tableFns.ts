import type {
  Observable,
  ObservableFlag,
} from '#/components/Observables/observables.types'
import type { FilterFn, SortingFn } from '@tanstack/react-table'

const UNIT_MIN: Record<string, number> = { m: 1, h: 60, d: 1440 }

export const addedMinutes = (s: string) => {
  const relative = /^(\d+)\s*([mhd])$/.exec(s.trim())
  if (relative) return Number(relative[1]) * UNIT_MIN[relative[2]]

  const absolute = /^(\d{2}):(\d{2})$/.exec(s.trim())
  if (!absolute) return Number.POSITIVE_INFINITY
  return Number(absolute[1]) * 60 + Number(absolute[2])
}

export const byAdded: SortingFn<Observable> = (a, b) =>
  addedMinutes(a.original.added) - addedMinutes(b.original.added)

export const includesOneString: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

export const includesAnySubstring: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const cell = String(row.getValue(columnId)).toLowerCase()
  return filterValue.some((query) => cell.includes(query.toLowerCase()))
}

export const includesAnyFlag: FilterFn<Observable> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true
  const flags = row.getValue<ObservableFlag[]>(columnId)
  return filterValue.some((flag) => flags.includes(flag as ObservableFlag))
}

export function flagLabel(flag: ObservableFlag) {
  return flag === 'ioc' ? 'IOC' : 'SIGHTED'
}

export function addFlag(flags: ObservableFlag[], flag: ObservableFlag) {
  return flags.includes(flag) ? flags : [...flags, flag]
}

export function toggleFlag(flags: ObservableFlag[], flag: ObservableFlag) {
  return flags.includes(flag)
    ? flags.filter((item) => item !== flag)
    : [...flags, flag]
}
