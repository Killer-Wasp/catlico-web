import type { CaseStatus, Severity, Tlp } from '#/lib/domain'

// Case row as the Cases list view consumes it. The same shape TheHive's
// `listCase` query returns, trimmed to what the list needs.
export type Case = {
  id: string
  sev: Severity
  tlp: Tlp
  status: CaseStatus
  statusName: string
  title: string
  assignee: string
  tags: string[]
  tasksDone: number
  tasksTotal: number
  created: string
  updated: string
  duplicateOf?: string
}
