import {
  getCaseDetail,
  getCaseRouteId,
  normalizeCaseId,
  toCaseDetail,
} from '#/components/Cases/caseDetails'
import { describe, expect, test } from 'vitest'

describe('case detail data helpers', () => {
  test('normalizes route ids to case ids', () => {
    expect(normalizeCaseId('1842')).toBe('#1842')
    expect(normalizeCaseId('#1842')).toBe('#1842')
  })

  test('creates route ids from case ids', () => {
    expect(getCaseRouteId('#1842')).toBe('1842')
  })

  test('loads the prototype OAuth case details', () => {
    const detail = getCaseDetail('1842')

    expect(detail.id).toBe('#1842')
    expect(detail.title).toBe(
      'OAuth consent grant — privileged account compromise',
    )
    expect(detail.pap).toBe(2)
    expect(detail.businessUnit).toBe('Corporate IT')
    expect(detail.customFields).toEqual([
      ['Campaign ID', 'BILL-2026-Q2'],
      ['Affected users', '3'],
      ['Data classification', 'Confidential'],
    ])
    expect(detail.linkedAlerts.map((alert) => alert.id)).toEqual([
      'AL-9119',
      'AL-9102',
    ])
    expect(detail.responders).toHaveLength(4)
    expect(detail.ttps).toEqual([
      'T1528',
      'T1566.002',
      'T1114.003',
      'T1098.005',
    ])
  })

  test('falls back to the first case for unknown route ids', () => {
    expect(getCaseDetail('not-a-case').id).toBe('#1842')
  })

  test('maps backend case detail resources into the UI detail model', () => {
    const detail = toCaseDetail({
      case: {
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
      },
      tasks: [
        {
          id: '9dc5dfb8-1eca-4374-8421-bf3d246e54e0',
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
          id: '40e12bc6-75bc-4a82-82c1-363a570d7f15',
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
      ],
      observables: [
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
      ],
      comments: [
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
      ],
      members: [
        {
          user_id: '3713abbf-4e3c-401c-bd0b-e8a2f5597554',
          email: 'p.nguyen@catlico.test',
        },
      ],
      activity: [
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
      ],
    })

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
      tasksDone: 1,
      tasksTotal: 2,
      source: 'Backend',
      businessUnit: 'Unspecified',
      customFields: [
        ['campaign id', 'BILL-2026-Q2'],
        ['affected users', '3'],
      ],
    })
    expect(detail.descriptionMarkdown).toBe(
      'First paragraph\n\nSecond paragraph',
    )
    expect(detail.summary).toBe('Tokens revoked for affected accounts.')
    expect(detail.tasks.map((task) => task.status)).toEqual([
      'inprogress',
      'completed',
    ])
    expect(detail.tasks.map((task) => [task.id, task.apiId])).toEqual([
      ['T-1842-2', '9dc5dfb8-1eca-4374-8421-bf3d246e54e0'],
      ['T-1842-1', '40e12bc6-75bc-4a82-82c1-363a570d7f15'],
    ])
    expect(detail.tasks[0].flagged).toBe(true)
    expect(detail.observables[0]).toMatchObject({
      type: 'url',
      value: 'hxxps://cdn-au-billing[.]net/invoice.php',
      ioc: true,
      sighted: false,
      analysis: 'URLscan complete',
    })
    expect(detail.comments[0]).toMatchObject({
      author: 'P. Nguyen',
      body: '@J. Tanaka audit log pulled.',
    })
    expect(detail.timeline[0]).toMatchObject({
      text: '@J. Tanaka audit log pulled.',
      who: 'P. Nguyen',
      kind: 'comment',
    })
    expect(detail.timeline[1]).toMatchObject({
      text: '**update** case 1842',
      who: 'J. Tanaka',
      kind: 'audit',
    })
    expect(detail.attachments).toEqual([])
    expect(detail.responders).toEqual([])
    expect(detail.related).toEqual([])
    expect(detail.ttps).toEqual([])
  })
})
