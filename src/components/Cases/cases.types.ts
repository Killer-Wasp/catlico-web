import type { CaseStatus, Severity, Tlp } from '#/lib/domain'
import type { AssigneeRef } from '#/components/Assign/assignees'

/** Resolve-SLA state for an open case, from the API. `null` ⇒ no policy / not open. */
export type SlaState = 'ok' | 'at-risk' | 'breached' | null

// Case row as the Cases list view consumes it. The same shape TheHive's
// `listCase` query returns, trimmed to what the list needs.
export type Case = {
  id: string
  sev: Severity
  tlp: Tlp
  pap: Tlp
  status: CaseStatus
  statusName: string
  title: string
  assignee: string
  /** Full assignee set (primary flagged + collaborators). */
  assignees?: AssigneeRef[]
  tags: string[]
  tasksDone: number
  tasksTotal: number
  created: string
  updated: string
  createdAt: string
  updatedAt: string
  /** ISO time the case's resolve-SLA is due, or null when no policy applies. */
  slaDueAt: string | null
  /** SLA state for an open case (ok | at-risk | breached), else null. */
  slaState: SlaState
  duplicateOf?: string
}
