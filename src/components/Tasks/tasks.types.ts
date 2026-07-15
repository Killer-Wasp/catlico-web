import type { AssigneeRef } from '#/components/Assign/assignees'

export type TaskStatus = 'waiting' | 'inprogress' | 'completed' | 'cancelled'

export type TaskStatusFilter = TaskStatus | 'open' | 'all'

export type Task = {
  id: string
  /** Numeric task id within its case (composite key part). */
  apiId?: number
  /** Numeric case id the task belongs to (composite key part). */
  caseApiId?: number
  title: string
  description: string
  kind: string
  flagged?: boolean
  caseId: string
  caseSeverity: 'critical' | 'high'
  assignee?: string
  /** Full assignee set (primary flagged + collaborators). */
  assignees?: AssigneeRef[]
  due: string
  dueAt?: string
  overdue?: boolean
  urgent?: boolean
  status: TaskStatus
}
