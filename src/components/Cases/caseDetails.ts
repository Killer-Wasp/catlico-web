import type { CaseStatus, Pap, Severity, Tlp } from '#/lib/domain'
import { TLP } from '#/lib/domain'
import type { MemberPublic } from './caseUsers'
import { memberDisplayNameById } from './caseUsers'
import type { AttachmentPublic } from './casesQueries'
import type {
  CaseDetail,
  CaseDetailTaskLog,
  CaseDetailTaskStatus,
} from './caseDetails.types'

export type CaseTaskSummary = {
  id: string
  title: string
  status: string
}

export type CasePublic = {
  id: number
  title: string
  description: string
  severity: number
  tlp: number
  pap: number
  status: string
  flagged: boolean
  assignee_id: string | null
  assignee_email: string | null
  tags: string[]
  tasks: CaseTaskSummary[]
  start_date: string | null
  end_date: string | null
  summary: string | null
  resolution_status: string | null
  impact_status: string | null
  duplicate_of_case_id: number | null
  merged_into: number | null
  merged_from: number[]
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string | null
}

export type TaskPublic = {
  id: number
  public_id?: string
  case_id: number
  organisation_id: string
  title: string
  group: string
  description: string
  status: string
  assignee_id: string | null
  order: number
  flagged: boolean
  start_date: string | null
  due_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string | null
}

export type ObservablePublic = {
  id: string
  case_id: number | null
  alert_id: number | null
  observable_type: string
  data: string
  message: string
  tlp: number
  ioc: boolean
  sighted: boolean
  ignore_similarity: boolean
  organisation_id: string
  created_at: string
  updated_at: string | null
}

export type CommentPublic = {
  id: string
  entity_type: string
  entity_id: string
  message: string
  organisation_id: string
  created_at: string
  created_by: string
  updated_at: string | null
  author_name: string
}

export type AuditPublic = {
  id: number
  request_id: string
  action: string
  main_action: boolean
  object_type: string
  object_id: string
  context_type: string | null
  context_id: string | null
  actor: string
  details: Record<string, unknown> | null
  created_at: string
}

export type WorkLogAttachmentPublic = {
  id: string
  filename?: string
  name?: string
  size?: number | string | null
  url?: string | null
}

export type WorkLogPublic = {
  id: number
  public_id?: string
  case_id: number
  task_id: number
  message?: string
  body?: string
  created_by: string
  created_at: string
  updated_at: string | null
  attachments?: WorkLogAttachmentPublic[]
}

export type CaseDetailResources = {
  case: CasePublic
  tasks: TaskPublic[]
  observables: ObservablePublic[]
  comments: CommentPublic[]
  activity: AuditPublic[]
  attachments?: AttachmentPublic[]
  members?: MemberPublic[]
  workLogs?: Record<string, WorkLogPublic[]>
}

function formatBlobSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toCaseDetailAttachment(
  a: AttachmentPublic,
): CaseDetail['attachments'][number] {
  const ext = a.name.includes('.')
    ? a.name.split('.').pop()!.toUpperCase()
    : (a.content_type.split('/')[1]?.toUpperCase() ?? 'FILE')
  return {
    id: a.attachment_id,
    linkId: a.id,
    kind: ext,
    name: a.name,
    size: formatBlobSize(a.size),
    sizeBytes: a.size,
    sha256: a.sha256,
    contentType: a.content_type,
    author: a.created_by,
    time: compactTime(a.created_at),
  }
}

export function normalizeCaseId(routeId: string) {
  return routeId.startsWith('#') ? routeId : `#${routeId}`
}

export function getCaseRouteId(caseId: string) {
  return caseId.replace(/^#/, '')
}

export function trafficLabel(value: Tlp | Pap) {
  return TLP[value].toUpperCase()
}

const STATUS_MAP: Record<string, { id: CaseStatus; name: string }> = {
  Open: { id: 'open', name: 'Open' },
  Resolved: { id: 'resolved', name: 'Resolved' },
  Duplicated: { id: 'duplicated', name: 'Duplicated' },
}

const TASK_STATUS_MAP: Record<string, CaseDetailTaskStatus> = {
  Waiting: 'waiting',
  InProgress: 'inprogress',
  Completed: 'completed',
  Cancelled: 'cancel',
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

function compactDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function taskPublicId(task: TaskPublic): string {
  return task.public_id?.trim() || `T-${task.case_id}-${task.order + 1}`
}

function formatFileSize(size: WorkLogAttachmentPublic['size']) {
  if (size == null || size === '') return 'file'
  if (typeof size === 'string') return size
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function toCaseDetailTaskLog(
  log: WorkLogPublic,
  displayNameByUserId: Map<string, string> = new Map(),
): CaseDetailTaskLog {
  return {
    id: log.public_id ?? `TL-${log.case_id}-${log.task_id}-${log.id}`,
    apiId: log.id,
    caseId: log.case_id,
    taskId: log.task_id,
    author: displayNameByUserId.get(log.created_by) ?? log.created_by,
    time: compactTime(log.created_at),
    body: log.message ?? log.body ?? '',
    attachments: (log.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name ?? attachment.filename ?? 'attachment',
      size: formatFileSize(attachment.size),
      ...(attachment.url ? { url: attachment.url } : {}),
    })),
  }
}

function customFieldRows(fields: Record<string, unknown>): [string, string][] {
  return Object.entries(fields).map(([key, value]) => [
    key.replaceAll('_', ' '),
    value == null ? '' : String(value),
  ])
}

function taskStatus(status: string) {
  return TASK_STATUS_MAP[status] ?? TASK_STATUS_MAP.Waiting
}

function resolvedActor(
  actor: string,
  displayNameByUserId: Map<string, string>,
): string {
  if (actor === 'system' || actor === 'analyzer') return actor
  return displayNameByUserId.get(actor) ?? actor
}

function auditText(event: AuditPublic) {
  const label = auditLabel(event)
  return `**${event.action}** ${event.object_type} ${label}`
}

function auditLabel(event: AuditPublic): string {
  // ponytail: extract human label from details when available; fall back to raw id
  const title = event.details?.title
  if (title && typeof title === 'string') return title
  const name = event.details?.name
  if (name && typeof name === 'string') return name
  return event.object_id
}

function timelineLink(event: AuditPublic, caseId: number): string | undefined {
  const entityId = event.object_id
  switch (event.object_type) {
    case 'case':
      return `/cases/${entityId}`
    case 'task':
      return `/cases/${caseId}/tasks`
    case 'comment':
      return `/cases/${caseId}/comments`
    case 'log':
      return `/cases/${caseId}/tasks`
    case 'observable':
      return `/cases/${caseId}/observables`
    case 'alert':
      return `/alerts`
    default:
      return undefined
  }
}

export function toCaseDetail(resources: CaseDetailResources): CaseDetail {
  const { case: caseItem, tasks, observables, comments, activity } = resources
  const displayNameByUserId = memberDisplayNameById(resources.members)
  const status = STATUS_MAP[caseItem.status] ?? {
    id: 'open' as const,
    name: caseItem.status,
  }
  const activeTasks = tasks.filter((task) => task.status !== 'Cancelled')

  return {
    id: `#${caseItem.id}`,
    sev: clamp(caseItem.severity, 1, 4) as Severity,
    tlp: clamp(caseItem.tlp, 0, 3) as Tlp,
    pap: clamp(caseItem.pap, 0, 3) as Pap,
    status: status.id,
    statusName: status.name,
    title: caseItem.title,
    assignee: caseItem.assignee_email ?? 'Unassigned',
    tags: caseItem.tags,
    tasksDone: activeTasks.filter((task) => task.status === 'Completed').length,
    tasksTotal: activeTasks.length,
    opened: compactDateTime(caseItem.start_date ?? caseItem.created_at),
    sla: 'No SLA set',
    source: 'Backend',
    businessUnit:
      caseItem.custom_fields.business_unit == null
        ? 'Unspecified'
        : String(caseItem.custom_fields.business_unit),
    descriptionMarkdown: caseItem.description,
    summary: caseItem.summary?.trim() || null,
    customFields: customFieldRows(caseItem.custom_fields),
    linkedAlerts: [],
    tasks: tasks.map((task) => {
      const workLogs = (resources.workLogs?.[task.id] ?? []).map((log) =>
        toCaseDetailTaskLog(log, displayNameByUserId),
      )
      return {
        id: taskPublicId(task),
        apiId: task.id,
        caseId: task.case_id,
        title: task.title,
        group: task.group || 'General',
        status: taskStatus(task.status),
        assignee: task.assignee_id ?? 'Unassigned',
        flagged: task.flagged,
        due: task.due_date,
        start: task.start_date,
        end: task.end_date,
        description: task.description,
        logs: workLogs.length,
        workLogs,
      }
    }),
    observables: observables.map((observable) => ({
      id: observable.id,
      type: observable.observable_type,
      value: observable.data,
      ioc: observable.ioc,
      sighted: observable.sighted,
      analysis: observable.message || '-',
      added: compactTime(observable.created_at),
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      author: comment.author_name,
      time: compactTime(comment.created_at),
      body: comment.message,
    })),
    attachments: (resources.attachments ?? []).map(toCaseDetailAttachment),
    shares: 0,
    timeline: [
      ...activity.map((event) => ({
        when: compactTime(event.created_at),
        text: auditText(event),
        who: resolvedActor(event.actor, displayNameByUserId),
        tone: (event.action === 'delete' ? 'warn' as const : undefined),
        kind: 'audit' as const,
        createdAt: event.created_at,
        link: timelineLink(event, caseItem.id),
      })),
      ...comments.map((comment) => ({
        when: compactTime(comment.created_at),
        text: comment.message,
        who: comment.author_name,
        kind: 'comment' as const,
        createdAt: comment.created_at,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    responders: [],
    related: [
      ...caseItem.merged_from.map((id) => ({
        id: `#${id}`,
        title: 'Merged source case',
      })),
      ...(caseItem.duplicate_of_case_id == null
        ? []
        : [
            {
              id: `#${caseItem.duplicate_of_case_id}`,
              title: 'Duplicate of case',
            },
          ]),
    ],
    ttps: caseItem.tags.filter((tag) => /^T\d{4}(?:\.\d{3})?$/.test(tag)),
  }
}
