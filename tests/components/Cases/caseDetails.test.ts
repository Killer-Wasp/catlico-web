import {
  getCaseRouteId,
  normalizeCaseId,
  toCaseDetail,
  toCaseDetailObservables,
  toCaseDetailTasks,
  toCaseDetailTimeline,
} from '#/components/Cases/caseDetails'
import type {
  AuditPublic,
  CasePublic,
  CommentPublic,
  ObservablePublic,
  TaskPublic,
} from '#/components/Cases/caseDetails'
import type { MemberPublic } from '#/components/Cases/caseUsers'
import { describe, expect, test } from 'vitest'

const CASE: CasePublic = {
  id: 1842,
  title: 'OAuth consent grant',
  description: 'First paragraph\n\nSecond paragraph',
  severity: 4,
  tlp: 2,
  pap: 1,
  status: 'Open',
  flagged: true,
  assignee_id: '2a87826f-d7af-4938-9713-7c5ef3d39ec2',
  assignee_email: 'j.tanaka@catlico.test',
  tags: ['identity', 'bec'],
  tasks: [],
  start_date: '2026-06-12T09:12:00Z',
  end_date: null,
  summary: 'Tokens revoked for affected accounts.',
  resolution_status: null,
  impact_status: null,
  duplicate_of_case_id: null,
  merged_into: null,
  merged_from: [],
  custom_fields: {
    campaign_id: 'BILL-2026-Q2',
    affected_users: 3,
  },
  created_at: '2026-06-12T09:12:00Z',
  updated_at: '2026-06-12T10:05:00Z',
  sla_due_at: null,
  sla_state: null,
}

const TASKS: TaskPublic[] = [
  {
    id: 2,
    case_id: 1842,
    organisation_id: 'org-1',
    title: 'Disable malicious app registration tenant-wide',
    group: 'Contain',
    description: 'Block the app registration across the tenant.',
    status: 'InProgress',
    assignee_id: null,
    order: 1,
    flagged: true,
    start_date: '2026-06-12T10:05:00Z',
    due_date: '2026-06-12T13:00:00Z',
    end_date: null,
    created_at: '2026-06-12T10:00:00Z',
    updated_at: null,
  },
  {
    id: 1,
    case_id: 1842,
    organisation_id: 'org-1',
    title: 'Revoke refresh tokens',
    group: 'Contain',
    description: '',
    status: 'Completed',
    assignee_id: null,
    order: 0,
    flagged: false,
    start_date: null,
    due_date: null,
    end_date: '2026-06-12T09:54:00Z',
    created_at: '2026-06-12T09:40:00Z',
    updated_at: null,
  },
]

const OBSERVABLES: ObservablePublic[] = [
  {
    id: 'a276a296-3609-4926-b159-b9f506fcd668',
    case_id: 1842,
    alert_id: null,
    observable_type: 'url',
    data: 'hxxps://cdn-au-billing[.]net/invoice.php',
    message: 'URLscan complete',
    tlp: 2,
    ioc: true,
    sighted: false,
    ignore_similarity: false,
    organisation_id: 'org-1',
    created_at: '2026-06-12T09:21:00Z',
    updated_at: null,
  },
]

const COMMENTS: CommentPublic[] = [
  {
    id: '753481c8-887c-4b8f-9433-7b361e55ba2d',
    entity_type: 'case',
    entity_id: '1842',
    message: '@J. Tanaka audit log pulled.',
    organisation_id: 'org-1',
    created_at: '2026-06-12T10:21:00Z',
    created_by: '3713abbf-4e3c-401c-bd0b-e8a2f5597554',
    updated_at: null,
    author_name: 'P. Nguyen',
  },
]

const ACTIVITY: AuditPublic[] = [
  {
    id: 21,
    request_id: 'req-1',
    action: 'update',
    main_action: true,
    object_type: 'case',
    object_id: '1842',
    context_type: 'case',
    context_id: '1842',
    actor: 'J. Tanaka',
    details: { status: 'Open' },
    created_at: '2026-06-12T10:05:00Z',
  },
]

const MEMBERS: MemberPublic[] = [
  {
    user_id: '3713abbf-4e3c-401c-bd0b-e8a2f5597554',
    email: 'p.nguyen@catlico.test',
  },
]

describe('case detail data helpers', () => {
  test('normalizes route ids to case ids', () => {
    expect(normalizeCaseId('1842')).toBe('#1842')
    expect(normalizeCaseId('#1842')).toBe('#1842')
  })

  test('creates route ids from case ids', () => {
    expect(getCaseRouteId('#1842')).toBe('1842')
  })

  test('maps a backend case into the core UI detail model', () => {
    const detail = toCaseDetail(CASE)

    expect(detail).toMatchObject({
      id: '#1842',
      sev: 4,
      tlp: 2,
      pap: 1,
      status: 'open',
      statusName: 'Open',
      title: 'OAuth consent grant',
      assignee: 'j.tanaka@catlico.test',
      tags: ['identity', 'bec'],
      closed: null,
      customFields: [
        ['campaign id', 'BILL-2026-Q2'],
        ['affected users', '3'],
      ],
    })
    expect(detail.opened).not.toBe('')
    // dayjs().fromNow() — a human relative time like "3 hours ago".
    expect(detail.openedAgo).toMatch(/ ago$/)
    expect(detail.updated).not.toBeNull()
    expect(detail.updatedAgo).toMatch(/ ago$/)
    expect(detail.descriptionMarkdown).toBe(
      'First paragraph\n\nSecond paragraph',
    )
    expect(detail.summary).toBe('Tokens revoked for affected accounts.')
    expect(detail.related).toEqual([])
  })

  test('maps tasks (with work-logs) for the tasks panel', () => {
    const tasks = toCaseDetailTasks(TASKS)

    expect(tasks.map((task) => task.status)).toEqual([
      'inprogress',
      'completed',
    ])
    expect(tasks.map((task) => [task.id, task.apiId])).toEqual([
      ['T-1842-2', 2],
      ['T-1842-1', 1],
    ])
    expect(tasks[0].flagged).toBe(true)
  })

  test('maps observables for the observables panel', () => {
    const observables = toCaseDetailObservables(OBSERVABLES)

    expect(observables[0]).toMatchObject({
      type: 'url',
      value: 'hxxps://cdn-au-billing[.]net/invoice.php',
      ioc: true,
      sighted: false,
      analysis: 'URLscan complete',
    })
  })

  test('merges activity and comments into the timeline, newest first', () => {
    const timeline = toCaseDetailTimeline(ACTIVITY, COMMENTS, 1842, MEMBERS)

    expect(timeline[0]).toMatchObject({
      text: '@J. Tanaka audit log pulled.',
      who: 'P. Nguyen',
      kind: 'comment',
    })
    // Audit rows now carry the structured action/objectType the timeline uses to
    // render its verb phrase ("Update case"); `text` holds only a detail label
    // (title/name) when the backend provides one, else it's empty.
    expect(timeline[1]).toMatchObject({
      text: '',
      who: 'J. Tanaka',
      kind: 'audit',
      action: 'update',
      objectType: 'case',
    })
  })
})
