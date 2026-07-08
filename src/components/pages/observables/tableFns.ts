import type {
  Observable,
  ObservableFlag,
} from '#/components/Observables/observables.types'
import type { SortingFn } from '@tanstack/react-table'

export const byAdded: SortingFn<Observable> = (a, b) =>
  new Date(b.original.addedAt).getTime() -
  new Date(a.original.addedAt).getTime()

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
