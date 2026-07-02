import type { TaskStatus } from '#/components/Tasks/tasks.types'

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'inprogress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
