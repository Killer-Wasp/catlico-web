import type { Alert } from '#/components/Alerts/alerts.types'
import type { SortingFn } from '@tanstack/react-table'

// Sort the "Alert" column by the numeric id (e.g. "AL-9123").
export const byAlertId: SortingFn<Alert> = (a, b) =>
  Number(a.original.id.replace(/\D/g, '')) -
  Number(b.original.id.replace(/\D/g, ''))

// Sort "Age" chronologically by the underlying minutes.
export const byAge: SortingFn<Alert> = (a, b) =>
  a.original.ageMin - b.original.ageMin
