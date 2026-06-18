import type { CaseStatus, Pap, Severity, Tlp } from '#/lib/domain'

export type CaseDetailTaskStatus =
  | 'waiting'
  | 'inprogress'
  | 'completed'
  | 'cancel'

export type CaseDetailTask = {
  id: string
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
  author: string
  time: string
  body: string
}

export type CaseDetailObservable = {
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
  author: string
  time: string
  body: string
}

export type CaseDetailAttachment = {
  kind: string
  name: string
  size: string
  sha256: string
  author: string
  time: string
}

export type CaseDetailTimelineEvent = {
  when: string
  text: string
  who: string
  tone?: 'warn' | 'ok'
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
  description: string[]
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
