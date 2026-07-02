import type { CaseDetailTask } from '#/components/Cases/caseDetails.types'

export const TASK_STATUS: Record<
  CaseDetailTask['status'],
  { color: string; label: string }
> = {
  completed: { color: 'green', label: 'Completed' },
  inprogress: { color: 'yellow', label: 'In progress' },
  waiting: { color: 'gray', label: 'Waiting' },
  cancel: { color: 'gray', label: 'Cancelled' },
}

export const TASK_STATUS_OPTIONS = (
  ['waiting', 'inprogress', 'completed', 'cancel'] as const
).map((value) => ({ value, label: TASK_STATUS[value].label }))

export const TASK_EDGE_COLOR: Record<CaseDetailTask['status'], string> = {
  waiting: 'var(--mantine-color-gray-6)',
  inprogress: 'var(--mantine-color-yellow-6)',
  completed: 'var(--mantine-color-green-6)',
  cancel: 'var(--mantine-color-gray-5)',
}

export const TEAM_OPTIONS = [
  'Unassigned',
  'J. Tanaka',
  'P. Nguyen',
  'A. Whitford',
  'S. Iyer',
]

// "2026-06-12T10:00" → "Fri 10:00 am" — the relative weekday + time shown
// on each task's due badge.
export function formatDue(due: string) {
  const date = new Date(due)
  const day = date.toLocaleDateString('en-US', { weekday: 'short' })
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
  return `${day} ${time}`
}

export function taskMeta(task: CaseDetailTask) {
  return [
    task.group,
    task.assignee === 'Unassigned' ? null : task.assignee,
    task.logs > 0 ? `${task.logs} log${task.logs === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function formatTaskDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDueInput(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isTaskOverdue(task: CaseDetailTask) {
  return Boolean(task.due && new Date(task.due).getTime() < Date.now())
}
