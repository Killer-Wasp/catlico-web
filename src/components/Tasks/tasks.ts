import type { Task, TaskStatus, TaskStatusFilter } from './tasks.types'

export const TASK_STATUS_TABS: { value: TaskStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'inprogress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  waiting: 'WAITING',
  inprogress: 'IN PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
}

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  waiting: 'gray',
  inprogress: 'yellow',
  completed: 'green',
  cancelled: 'red',
}

export function filterTasksByStatus(tasks: Task[], filter: TaskStatusFilter) {
  if (filter === 'all') return tasks
  if (filter === 'open') {
    return tasks.filter(
      (task) => task.status !== 'completed' && task.status !== 'cancelled',
    )
  }
  return tasks.filter((task) => task.status === filter)
}

export function advanceTaskStatus(status: TaskStatus): TaskStatus {
  if (status === 'waiting') return 'inprogress'
  if (status === 'inprogress') return 'completed'
  return status
}

export function allocateNextTaskId(
  tasks: Array<Pick<Task, 'id' | 'caseId'>>,
  caseId: string,
) {
  const caseNumber = caseId.replace('#', '')
  const prefix = `T-${caseNumber}-`
  const maxSequence = tasks
    .filter((task) => task.caseId.replace('#', '') === caseNumber)
    .reduce((max, task) => {
      if (!task.id.startsWith(prefix)) return max
      const sequence = Number(task.id.slice(prefix.length))
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max
    }, 0)

  return `${prefix}${maxSequence + 1}`
}

export function avatarFor(name: string): [string, string] {
  const initials = name
    .split(/\s+/)
    .map((part) => part.replace('.', '').at(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const colors = ['orange', 'teal', 'brown', 'indigo', 'grape']
  const index = Array.from(name).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  )

  return [initials || '?', colors[index % colors.length]]
}
