import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { Task, TaskStatus } from './tasks.types'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

export type BackendTaskStatus =
  | 'Waiting'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'

export type TaskPublic = {
  id: string
  public_id: string
  case_id: number
  organisation_id: string
  title: string
  group: string
  description: string
  status: BackendTaskStatus
  assignee_id: string | null
  order: number
  flagged: boolean
  start_date: string | null
  due_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string | null
}

export type TaskQueuePublic = TaskPublic & {
  case_title: string
  case_severity: number
  assignee_email: string | null
}

export type TaskListFilters = {
  skip?: number
  limit?: number
}

export type TasksResult = {
  tasks: Task[]
  total: number
}

export const DEFAULT_TASK_FILTERS: Required<TaskListFilters> = {
  skip: 0,
  limit: 200,
}

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskListFilters = DEFAULT_TASK_FILTERS) =>
    [...taskKeys.lists(), filters] as const,
}

const STATUS_FROM_API: Record<BackendTaskStatus, TaskStatus> = {
  Waiting: 'waiting',
  InProgress: 'inprogress',
  Completed: 'completed',
  Cancelled: 'cancelled',
}

const STATUS_TO_API: Record<TaskStatus, BackendTaskStatus> = {
  waiting: 'Waiting',
  inprogress: 'InProgress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function toTask(dto: TaskPublic | TaskQueuePublic): Task {
  const dueTime = dto.due_date ? new Date(dto.due_date).getTime() : null
  const overdue = dueTime != null && dueTime < Date.now()
  const urgent = dueTime != null && dueTime - Date.now() < 24 * 60 * 60 * 1000
  const queueContext = 'case_title' in dto ? dto : null

  return {
    id: dto.public_id,
    apiId: dto.id,
    title: dto.title,
    description: dto.description || queueContext?.case_title || '',
    kind: dto.group || 'General',
    flagged: dto.flagged || undefined,
    caseId: `#${dto.case_id}`,
    caseSeverity: (queueContext?.case_severity ?? 3) >= 4 ? 'critical' : 'high',
    assignee: queueContext?.assignee_email ?? undefined,
    due: formatDueDate(dto.due_date),
    dueAt: dto.due_date ?? undefined,
    overdue: overdue || undefined,
    urgent: !overdue && urgent ? true : undefined,
    status: STATUS_FROM_API[dto.status],
  }
}

export async function fetchTasks(
  filters: TaskListFilters = DEFAULT_TASK_FILTERS,
): Promise<TasksResult> {
  const params = {
    limit: String(filters.limit ?? DEFAULT_TASK_FILTERS.limit),
    skip: String(filters.skip ?? DEFAULT_TASK_FILTERS.skip),
  }
  const page = await api
    .get('tasks/', { searchParams: params })
    .json<Page<TaskQueuePublic>>()

  return { tasks: page.items.map(toTask), total: page.total }
}

export const tasksQueryOptions = (
  filters: TaskListFilters = DEFAULT_TASK_FILTERS,
) =>
  queryOptions({
    queryKey: taskKeys.list(filters),
    queryFn: () => fetchTasks(filters),
  })

export async function updateTaskStatus({
  apiId,
  status,
}: {
  apiId: string
  status: TaskStatus
}): Promise<Task> {
  const dto = await api
    .patch(`tasks/${apiId}`, { json: { status: STATUS_TO_API[status] } })
    .json<TaskPublic>()

  return toTask(dto)
}
