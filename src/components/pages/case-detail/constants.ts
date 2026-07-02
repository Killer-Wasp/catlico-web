import { notifications } from '@mantine/notifications'

export const CASE_TABS = [
  'details',
  'tasks',
  'observables',
  'comments',
  'attachments',
  'timeline',
  'sharing',
] as const
export type CaseTab = (typeof CASE_TABS)[number]

export const actionNotice = (message: string) =>
  notifications.show({ color: 'orange', message })
