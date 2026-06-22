export type TaskStatus = 'waiting' | 'inprogress' | 'completed' | 'cancelled'

export type TaskStatusFilter = TaskStatus | 'open' | 'all'

export type Task = {
  id: string
  apiId?: string
  title: string
  description: string
  kind: string
  flagged?: boolean
  caseId: string
  caseSeverity: 'critical' | 'high'
  assignee?: string
  due: string
  dueAt?: string
  overdue?: boolean
  urgent?: boolean
  status: TaskStatus
}
