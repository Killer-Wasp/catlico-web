import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { AssigneeRefDTO } from '#/components/Assign/assignees'
import { toAssigneeRefs } from '#/components/Assign/assignees'
import { appendClauses } from '#/lib/filters'
import type { FilterClause } from '#/lib/filters'
import type { Task, TaskStatus } from './tasks.types'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

/** Column the task queue is sorted by, server-side. */
export type TaskSort = 'caseId' | 'title' | 'assignee' | 'due' | 'status'

export type BackendTaskStatus =
  | 'Waiting'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'

export type TaskPublic = {
  id: number
  public_id: string
  case_id: number
  organisation_id: string
  title: string
  group: string
  description: string
  status: BackendTaskStatus
  assignee_id: string | null
  assignees?: AssigneeRefDTO[]
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
  clauses?: FilterClause[]
  sort?: TaskSort
  order?: 'asc' | 'desc'
  skip?: number
  limit?: number
}

export type TasksResult = {
  tasks: Task[]
  total: number
}

/** Filterable values across the org's task queue, for the filter dropdowns. */
export type TaskFacets = {
  assignees: string[]
  unassigned: boolean
  kinds: string[]
}

/**
 * Default status filter for the task views: "not finished" (Waiting | InProgress).
 * Same-key clauses OR server-side. Shared by the list's default view and the
 * navbar's open-task badge so they stay in sync.
 */
export const DEFAULT_TASK_STATUS_CLAUSES: FilterClause[] = [
  { key: 'status', op: 'eq', value: 'Waiting' },
  { key: 'status', op: 'eq', value: 'InProgress' },
]

export const DEFAULT_TASK_FILTERS: TaskListFilters = {
  sort: 'caseId',
  order: 'asc',
  skip: 0,
  limit: 10,
  clauses: DEFAULT_TASK_STATUS_CLAUSES,
}

/**
 * Count-only query for open (Waiting | InProgress) tasks. `limit: 1` because only
 * `total` is read (a badge), not the rows.
 */
export const OPEN_TASK_FILTERS: TaskListFilters = {
  clauses: DEFAULT_TASK_STATUS_CLAUSES,
  skip: 0,
  limit: 1,
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
    caseApiId: dto.case_id,
    title: dto.title,
    description: dto.description || queueContext?.case_title || '',
    kind: dto.group || 'General',
    flagged: dto.flagged || undefined,
    caseId: `#${dto.case_id}`,
    caseSeverity: (queueContext?.case_severity ?? 3) >= 4 ? 'critical' : 'high',
    assignee: queueContext?.assignee_email ?? undefined,
    assignees: toAssigneeRefs(dto.assignees),
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
  const params = new URLSearchParams()
  appendClauses(params, filters.clauses)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.skip != null) params.set('skip', String(filters.skip))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  const page = await api
    .get('task-queue', { searchParams: params })
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

async function fetchTaskFacets(): Promise<TaskFacets> {
  return api.get('task-queue/filters').json<TaskFacets>()
}

export const taskFacetsQueryOptions = () =>
  queryOptions({
    queryKey: [...taskKeys.all, 'facets'] as const,
    queryFn: fetchTaskFacets,
  })

export async function updateTaskStatus({
  caseId,
  taskId,
  status,
}: {
  caseId: number
  taskId: number
  status: TaskStatus
}): Promise<Task> {
  const dto = await api
    .patch(`cases/${caseId}/tasks/${taskId}`, {
      json: { status: STATUS_TO_API[status] },
    })
    .json<TaskPublic>()

  return toTask(dto)
}

export async function assignTask({
  caseId,
  taskId,
  assigneeId,
}: {
  caseId: number
  taskId: number
  assigneeId: string | null
}): Promise<Task> {
  const dto = await api
    .patch(`cases/${caseId}/tasks/${taskId}`, {
      json: { assignee_id: assigneeId },
    })
    .json<TaskPublic>()

  return toTask(dto)
}
