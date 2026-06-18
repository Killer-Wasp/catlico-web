import type { CaseStatus, Pap, Severity, Tlp } from '#/lib/domain'
import { TLP } from '#/lib/domain'
import type { CaseDetail } from './caseDetails.types'

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
  id: string
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

export type CaseDetailResources = {
  case: CasePublic
  tasks: TaskPublic[]
  observables: ObservablePublic[]
  comments: CommentPublic[]
  activity: AuditPublic[]
}

export const caseDetails: CaseDetail[] = [
  {
    id: '#1842',
    sev: 3,
    tlp: 2,
    pap: 2,
    status: 'open',
    statusName: 'Open',
    title: 'OAuth consent grant — privileged account compromise',
    assignee: 'J. Tanaka',
    tags: ['T1528', 'identity', 'bec'],
    tasksDone: 3,
    tasksTotal: 7,
    opened: 'Today 09:12',
    sla: '3h 18m to SLA',
    source: 'Defender XDR',
    businessUnit: 'Corporate IT',
    description: [
      'Defender XDR raised AL-9119 after an unverified multi-tenant application (app id 7f3c…91ab) was granted Mail.ReadWrite and offline_access by three privileged users within 11 minutes.',
      'Consent grants followed a credential-phish lure (see linked alert AL-9102) referencing a fake billing portal. One account (svc-finops@origin…) shows mailbox rule creation post-consent — consistent with BEC staging.',
      'Working hypothesis: single actor, phish → consent grant → mailbox persistence. Containment is underway; tokens revoked for 2 of 3 accounts.',
    ],
    customFields: [
      ['Campaign ID', 'BILL-2026-Q2'],
      ['Affected users', '3'],
      ['Data classification', 'Confidential'],
    ],
    linkedAlerts: [
      {
        id: 'AL-9119',
        sev: 4,
        tlp: 2,
        title: 'OAuth consent grant to unverified app for 3 privileged users',
      },
      {
        id: 'AL-9102',
        sev: 3,
        tlp: 1,
        title:
          'Credential-phish campaign targeting retail billing team (38 rcpts)',
      },
    ],
    tasks: [
      {
        id: 'T-1843-1',
        title: 'Triage consent grant alert and confirm scope',
        group: 'Identify',
        status: 'completed',
        assignee: 'J. Tanaka',
        flagged: false,
        due: '2026-06-12T10:00',
        start: '2026-06-12T09:18',
        end: '2026-06-12T09:32',
        description:
          'Confirm the consent grant alert is genuine and determine which accounts, scopes, and app ids are involved.',
        logs: 2,
        workLogs: [
          {
            author: 'J. Tanaka',
            time: '12 June, 09:32 am',
            body: 'Confirmed alert as true positive. Three privileged users granted consent to the same unverified app.',
          },
          {
            author: 'J. Tanaka',
            time: '12 June, 09:38 am',
            body: 'Scoped initial blast radius to identity and mailbox access. Opened containment tasks.',
          },
        ],
      },
      {
        id: 'T-1843-2',
        title: 'Pull unified audit log for the 3 accounts (±24h)',
        group: 'Identify',
        status: 'completed',
        assignee: 'P. Nguyen',
        flagged: false,
        due: '2026-06-12T11:30',
        start: '2026-06-12T10:00',
        end: '2026-06-12T10:21',
        description:
          'Export unified audit logs around the consent grants and preserve relevant sign-in and mailbox events.',
        logs: 1,
        workLogs: [
          {
            author: 'P. Nguyen',
            time: '12 June, 10:21 am',
            body: 'UAL exported to evidence share. Consent grants preceded by click on hxxps://cdn-au-billing[.]net/invoice.php from Outlook on iOS for 2 of 3 users.',
          },
        ],
      },
      {
        id: 'T-1843-3',
        title: 'Revoke refresh tokens + reset credentials',
        group: 'Contain',
        status: 'completed',
        assignee: 'J. Tanaka',
        flagged: false,
        due: '2026-06-12T10:00',
        start: '2026-06-12T09:40',
        end: '2026-06-12T09:54',
        description:
          "Revoke active sessions and refresh tokens for the 3 accounts and force a password reset. Coordinate with the user's manager before the reset.",
        logs: 1,
        workLogs: [
          {
            author: 'J. Tanaka',
            time: '12 June, 09:54 am',
            body: 'Tokens revoked for all 3 accounts via Entra ID responder. Password reset enforced. Re-auth confirmed for m.keller and t.harland.',
          },
        ],
      },
      {
        id: 'T-1843-4',
        title: 'Disable malicious app registration tenant-wide',
        group: 'Contain',
        status: 'inprogress',
        assignee: 'J. Tanaka',
        flagged: true,
        due: '2026-06-12T13:00',
        start: '2026-06-12T10:05',
        end: null,
        description:
          "Block the app registration (app id 7f3c…91ab) across the tenant and add to the org's blocked apps policy. Coordinate with the Identity team if any legitimate consent exists.",
        logs: 1,
        workLogs: [
          {
            author: 'J. Tanaka',
            time: '12 June, 10:08 am',
            body: "App registration disabled in our tenant. Awaiting Identity team confirmation that it can be added to the tenant-wide blocklist (need approval as it's a 3-tenant policy change).",
          },
        ],
      },
      {
        id: 'T-1843-5',
        title: 'Remove mailbox rules and check forwarding',
        group: 'Eradicate',
        status: 'inprogress',
        assignee: 'A. Whitford',
        flagged: false,
        due: '2026-06-12T14:00',
        start: '2026-06-12T10:18',
        end: null,
        description:
          'Audit the 3 mailboxes for malicious inbox rules and external forwarding. The svc-finops mailbox already shows a rule "RSS Feeds2" that auto-deletes finance vendor mail.',
        logs: 1,
        workLogs: [
          {
            author: 'A. Whitford',
            time: '12 June, 10:32 am',
            body: 'svc-finops: removed "RSS Feeds2" rule that was moving billing@* to RSS Feeds and marking read. Captured rule definition as evidence.',
          },
        ],
      },
      {
        id: 'T-1843-6',
        title: 'Hunt for same app id across all tenants',
        group: 'Hunt',
        status: 'waiting',
        assignee: 'Unassigned',
        flagged: false,
        due: '2026-06-13T12:00',
        start: null,
        end: null,
        description:
          'Search for the same OAuth app id across all connected tenants and identify any related consent grants.',
        logs: 0,
        workLogs: [],
      },
      {
        id: 'T-1843-7',
        title: 'User comms + phishing-resistant MFA enrolment',
        group: 'Recover',
        status: 'waiting',
        assignee: 'Unassigned',
        flagged: false,
        due: '2026-06-14T17:00',
        start: null,
        end: null,
        description:
          'Prepare user communications and schedule phishing-resistant MFA enrolment for affected users.',
        logs: 0,
        workLogs: [],
      },
    ],
    observables: [
      {
        type: 'domain',
        value: 'login-originenergy.support',
        ioc: true,
        sighted: true,
        analysis: 'VT 12/93',
        added: '09:18',
      },
      {
        type: 'url',
        value: 'hxxps://cdn-au-billing[.]net/invoice.php',
        ioc: true,
        sighted: false,
        analysis: 'URLscan ✓',
        added: '09:21',
      },
      {
        type: 'mail',
        value: 'accounts@billing-origin.co',
        ioc: true,
        sighted: true,
        analysis: '—',
        added: '09:24',
      },
      {
        type: 'ip',
        value: '203.0.113.47',
        ioc: true,
        sighted: true,
        analysis: 'AbuseIPDB 97%',
        added: '09:30',
      },
      {
        type: 'other',
        value: 'app id 7f3c…91ab',
        ioc: false,
        sighted: false,
        analysis: '—',
        added: '09:33',
      },
    ],
    comments: [
      {
        author: 'P. Nguyen',
        time: '10:21',
        body: '@J. Tanaka audit log pulled — consent grants preceded by click on the billing lure for 2 of 3 users. See task 2.',
      },
      {
        author: 'J. Tanaka',
        time: '10:34',
        body: 'Thanks. svc-finops is a service account — owner notified before reset. Escalating severity to High.',
      },
    ],
    attachments: [
      {
        kind: 'JSON',
        name: 'rule-RSS-Feeds2.json',
        size: '2.1 KB',
        sha256: '4f0e7a91…c29a',
        author: 'A. Whitford',
        time: '10:32',
      },
      {
        kind: 'EML',
        name: 'AL-9119-export.eml',
        size: '148 KB',
        sha256: '77ab03d1…1f44',
        author: 'P. Nguyen',
        time: '09:44',
      },
      {
        kind: 'PNG',
        name: 'consent-grant-screenshot.png',
        size: '412 KB',
        sha256: 'b2c411ef…908d',
        author: 'J. Tanaka',
        time: '09:21',
      },
    ],
    shares: 2,
    timeline: [
      {
        when: '09:12',
        text: '**Case created** from alert AL-9119',
        who: 'J. Tanaka',
      },
      {
        when: '09:26',
        text: 'Severity raised to **High**, TLP set to AMBER',
        who: 'J. Tanaka',
        tone: 'warn',
      },
      {
        when: '09:41',
        text: 'Responder **Revoke user sessions** run on 2 accounts',
        who: 'Cortex',
        tone: 'ok',
      },
      {
        when: '10:05',
        text: 'Mailbox rule "RSS Feeds2" found on svc-finops — added as evidence',
        who: 'A. Whitford',
        tone: 'warn',
      },
      {
        when: '10:32',
        text: '4 observables pushed to **MISP** event 4417',
        who: 'P. Nguyen',
        tone: 'ok',
      },
    ],
    responders: [
      { action: 'Block sender domain', provider: 'Proofpoint' },
      { action: 'Isolate host', provider: 'CrowdStrike RTR' },
      { action: 'Revoke user sessions', provider: 'Entra ID' },
      { action: 'Export to MISP', provider: 'misp-push' },
    ],
    related: [
      { id: '#1788', title: 'Phish campaign — fake billing portal (resolved)' },
      { id: '#1731', title: 'BEC attempt — supplier invoice fraud' },
    ],
    ttps: ['T1528', 'T1566.002', 'T1114.003', 'T1098.005'],
  },
]

export function normalizeCaseId(routeId: string) {
  return routeId.startsWith('#') ? routeId : `#${routeId}`
}

export function getCaseRouteId(caseId: string) {
  return caseId.replace(/^#/, '')
}

export function getCaseDetail(routeId: string) {
  const caseId = normalizeCaseId(routeId)
  return (
    caseDetails.find((caseDetail) => caseDetail.id === caseId) ?? caseDetails[0]
  )
}

export function trafficLabel(value: Tlp | Pap) {
  return TLP[value].toUpperCase()
}

const STATUS_MAP: Record<string, { id: CaseStatus; name: string }> = {
  Open: { id: 'open', name: 'Open' },
  Resolved: { id: 'resolved', name: 'Resolved' },
  Duplicated: { id: 'duplicated', name: 'Duplicated' },
}

const TASK_STATUS_MAP = {
  Waiting: 'waiting',
  InProgress: 'inprogress',
  Completed: 'completed',
  Cancelled: 'cancel',
} as const

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

function compactTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function descriptionParts(description: string, summary: string | null) {
  return [...description.split(/\n{2,}/), summary]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
}

function customFieldRows(fields: Record<string, unknown>): [string, string][] {
  return Object.entries(fields).map(([key, value]) => [
    key.replaceAll('_', ' '),
    value == null ? '' : String(value),
  ])
}

function taskStatus(status: string) {
  return (
    TASK_STATUS_MAP[status as keyof typeof TASK_STATUS_MAP] ??
    TASK_STATUS_MAP.Waiting
  )
}

function auditText(event: AuditPublic) {
  return `**${event.action}** ${event.object_type} ${event.object_id}`
}

export function toCaseDetail(resources: CaseDetailResources): CaseDetail {
  const { case: caseItem, tasks, observables, comments, activity } = resources
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
    description: descriptionParts(caseItem.description, caseItem.summary),
    customFields: customFieldRows(caseItem.custom_fields),
    linkedAlerts: [],
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      group: task.group || 'General',
      status: taskStatus(task.status),
      assignee: task.assignee_id ?? 'Unassigned',
      flagged: task.flagged,
      due: task.due_date,
      start: task.start_date,
      end: task.end_date,
      description: task.description,
      logs: 0,
      workLogs: [],
    })),
    observables: observables.map((observable) => ({
      type: observable.observable_type,
      value: observable.data,
      ioc: observable.ioc,
      sighted: observable.sighted,
      analysis: observable.message || '-',
      added: compactTime(observable.created_at),
    })),
    comments: comments.map((comment) => ({
      author: comment.created_by,
      time: compactTime(comment.created_at),
      body: comment.message,
    })),
    attachments: [],
    shares: 0,
    timeline: activity.map((event) => ({
      when: compactTime(event.created_at),
      text: auditText(event),
      who: event.actor,
      tone: event.action === 'delete' ? 'warn' : undefined,
    })),
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
