import type { CaseStatus, Pap, Severity, Tlp } from '#/lib/domain'

export type CaseDetailTaskStatus =
  | 'waiting'
  | 'inprogress'
  | 'completed'
  | 'cancel'

export type CaseDetailTask = {
  /** Display/React-key id (e.g. T-1234-1). */
  id: string
  /** Numeric task id within its case (composite key part). */
  apiId: number
  /** Numeric case id the task belongs to (composite key part). */
  caseId: number
  title: string
  group: string
  status: CaseDetailTaskStatus
  assignee: string
  flagged: boolean
  due: string | null
  start: string | null
  end: string | null
  description: string
  logs: number
  workLogs: CaseDetailTaskLog[]
}

export type CaseDetailTaskLog = {
  /** Display/React-key id (e.g. TL-1234-1-1). */
  id: string
  /** Numeric worklog id within its task (composite key part). */
  apiId: number
  /** Numeric case id (composite key part). */
  caseId: number
  /** Numeric task id (composite key part). */
  taskId: number
  author: string
  time: string
  body: string
  attachments: CaseDetailTaskLogAttachment[]
}

export type CaseDetailTaskLogAttachment = {
  id: string
  name: string
  size: string
  url?: string
}

export type CaseDetailObservable = {
  id: string
  type: string
  value: string
  ioc: boolean
  sighted: boolean
  analysis: string
  added: string
}

export type CaseDetailAlert = {
  id: string
  title: string
  sev: Severity
  tlp: Tlp
}

export type CaseDetailComment = {
  id: string
  author: string
  time: string
  body: string
}

export type CaseDetailAttachment = {
  id: string
  /** Numeric per-case attachment id (composite key part). */
  linkId: number
  kind: string
  name: string
  size: string
  sizeBytes: number
  sha256: string
  /** content-type (e.g. application/pdf) */
  contentType: string
  author: string
  time: string
}

export type CaseDetailTimelineEvent = {
  when: string
  text: string
  who: string
  tone?: 'warn' | 'ok'
  kind: 'audit' | 'comment'
  createdAt: string
  link?: string
}

export type CaseDetail = {
  id: string
  sev: Severity
  tlp: Tlp
  pap: Pap
  status: CaseStatus
  statusName: string
  title: string
  assignee: string
  tags: string[]
  tasksDone: number
  tasksTotal: number
  opened: string
  sla: string
  source: string
  businessUnit: string
  /** Case description as Markdown (CommonMark), edited and rendered via Tiptap. */
  descriptionMarkdown: string
  /** Analyst working hypothesis (the case summary), shown below the description. */
  summary: string | null
  customFields: [string, string][]
  linkedAlerts: CaseDetailAlert[]
  tasks: CaseDetailTask[]
  observables: CaseDetailObservable[]
  comments: CaseDetailComment[]
  attachments: CaseDetailAttachment[]
  shares: number
  timeline: CaseDetailTimelineEvent[]
  responders: { action: string; provider: string }[]
  related: { id: string; title: string }[]
  ttps: string[]
}
