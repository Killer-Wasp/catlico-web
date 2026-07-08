import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { CaseStatus, Pap, Severity, Tlp } from '#/lib/domain'
import { TLP } from '#/lib/domain'
import type { MemberPublic } from './caseUsers'
import { memberDisplayNameById } from './caseUsers'
import type { AttachmentPublic } from './casesQueries'
import type {
  CaseDetail,
  CaseDetailAttachment,
  CaseDetailObservable,
  CaseDetailTask,
  CaseDetailTaskLog,
  CaseDetailTaskStatus,
  CaseDetailTimelineEvent,
} from './caseDetails.types'

dayjs.extend(relativeTime)

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
  /** Live work-log count from the list endpoint (for the "N logs" hint). */
  log_count?: number
  start_date: string | null
  due_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string | null
}

/** Slim view of the backend AlertPublic — the fields the case's linked-alerts panel needs. */
export type AlertPublic = {
  id: number
  title: string
  severity: number
  tlp: number
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

function formatBlobSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function toCaseDetailAttachment(
  a: AttachmentPublic,
): CaseDetailAttachment {
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

/**
 * Map the `tasks` panel's rows, fetched on demand. Work-logs are NOT loaded
 * here — the list shows only the server's `log_count` hint; a task's logs load
 * lazily when it is opened (see `toCaseDetailTaskLogs`).
 */
export function toCaseDetailTasks(tasks: TaskPublic[]): CaseDetailTask[] {
  return tasks.map((task) => ({
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
    logs: task.log_count ?? 0,
  }))
}

/** Map a task's work-logs, fetched on demand when the task is opened. */
export function toCaseDetailTaskLogs(
  logs: WorkLogPublic[],
  members?: MemberPublic[],
): CaseDetailTaskLog[] {
  const displayNameByUserId = memberDisplayNameById(members)
  return logs.map((log) => toCaseDetailTaskLog(log, displayNameByUserId))
}

/** Map the `observables` panel's rows, fetched on demand. */
export function toCaseDetailObservables(
  observables: ObservablePublic[],
): CaseDetailObservable[] {
  return observables.map((observable) => ({
    id: observable.id,
    type: observable.observable_type,
    value: observable.data,
    ioc: observable.ioc,
    sighted: observable.sighted,
    analysis: observable.message || '-',
    added: compactTime(observable.created_at),
    addedAt: observable.created_at,
  }))
}

/**
 * Merge audit activity and comments into the `timeline` panel's newest-first
 * event stream, fetched on demand.
 */
export function toCaseDetailTimeline(
  activity: AuditPublic[],
  comments: CommentPublic[],
  caseNumericId: number,
  members?: MemberPublic[],
): CaseDetailTimelineEvent[] {
  const displayNameByUserId = memberDisplayNameById(members)
  return [
    ...activity.map((event) => ({
      when: compactTime(event.created_at),
      text: auditText(event),
      who: resolvedActor(event.actor, displayNameByUserId),
      tone: event.action === 'delete' ? ('warn' as const) : undefined,
      kind: 'audit' as const,
      createdAt: event.created_at,
      link: timelineLink(event, caseNumericId),
    })),
    ...comments.map((comment) => ({
      when: compactTime(comment.created_at),
      text: comment.message,
      who: comment.author_name,
      kind: 'comment' as const,
      createdAt: comment.created_at,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/** Map a promoted alert to the side-rail's linked-alert row shape. */
export function toCaseDetailAlert(
  alert: AlertPublic,
): CaseDetail['linkedAlerts'][number] {
  return {
    id: `AL-${alert.id}`,
    title: alert.title,
    sev: clamp(alert.severity, 1, 4) as Severity,
    tlp: clamp(alert.tlp, 0, 3) as Tlp,
  }
}

/**
 * Map a backend `CasePublic` to the core `CaseDetail` shown by the always-visible
 * summary card, side rail, and Details tab. Linked alerts live in the always-visible
 * side rail, so they're passed in alongside the case; the heavy per-panel sections
 * (tasks, observables, comments, attachments, timeline) are fetched lazily by their
 * own panels — see `toCaseDetailTasks`/`toCaseDetailObservables`/`toCaseDetailTimeline`.
 */
export function toCaseDetail(
  caseItem: CasePublic,
  alerts: AlertPublic[] = [],
): CaseDetail {
  const status = STATUS_MAP[caseItem.status] ?? {
    id: 'open' as const,
    name: caseItem.status,
  }
  const openedIso = caseItem.start_date ?? caseItem.created_at

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
    opened: compactDateTime(openedIso),
    openedAgo: dayjs(openedIso).fromNow(),
    updated:
      caseItem.updated_at == null ? null : compactDateTime(caseItem.updated_at),
    updatedAgo:
      caseItem.updated_at == null ? null : dayjs(caseItem.updated_at).fromNow(),
    closed:
      caseItem.end_date == null ? null : compactDateTime(caseItem.end_date),
    sla: 'No SLA set',
    descriptionMarkdown: caseItem.description,
    summary: caseItem.summary?.trim() || null,
    customFields: customFieldRows(caseItem.custom_fields),
    linkedAlerts: alerts.map(toCaseDetailAlert),
    shares: 0,
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
