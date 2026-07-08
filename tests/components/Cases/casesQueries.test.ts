// @vitest-environment jsdom
import {
  caseFacetsQueryOptions,
  caseTaskLogsQueryOptions,
  caseTasksQueryOptions,
  casesQueryOptions,
  createTaskWorkLog,
  fetchCaseDetail,
  updateTaskWorkLog,
} from '#/components/Cases/casesQueries'
import type {
  CaseDetailTask,
  CaseDetailTaskLog,
} from '#/components/Cases/caseDetails.types'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const page = <T>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 100,
})

describe('case detail queries', () => {
  beforeEach(() => {
    localStorage.setItem('catlico.orgId', 'origin-soc')
    vi.mocked(api.get).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.post).mockReset()
  })

  test('fetches only the core case + linked alerts (no heavy child-resource fan-out)', async () => {
    const calls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      const endpoint = String(input)
      calls.push(endpoint)
      const payloads: Record<string, unknown> = {
        'cases/1842': {
          id: 1842,
          title: 'OAuth consent grant',
          description: 'Investigate consent grant.',
          severity: 3,
          tlp: 2,
          pap: 2,
          status: 'Open',
          flagged: false,
          assignee_id: null,
          assignee_email: null,
          tags: ['identity'],
          tasks: [],
          start_date: null,
          end_date: null,
          summary: null,
          resolution_status: null,
          impact_status: null,
          duplicate_of_case_id: null,
          merged_into: null,
          merged_from: [],
          custom_fields: {},
          created_at: '2026-06-12T09:12:00Z',
          updated_at: null,
        },
        'cases/1842/alerts': page([]),
      }
      return {
        json: async () => payloads[endpoint],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const detail = await fetchCaseDetail('1842')

    // The heavy sections (tasks, observables, comments, attachments, timeline)
    // are now lazy per-panel queries; opening a case is just case + alerts.
    expect(calls).toEqual(['cases/1842', 'cases/1842/alerts'])
    expect(detail).toMatchObject({
      id: '#1842',
      title: 'OAuth consent grant',
      assignee: 'Unassigned',
    })
  })

  test('the tasks query fetches the task list only (no per-task work-log fan-out)', async () => {
    const calls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      calls.push(String(input))
      return {
        json: async () =>
          page([
            {
              id: 1,
              case_id: 1842,
              organisation_id: 'org-1',
              title: 'Revoke refresh tokens and reset credentials',
              group: 'Contain',
              description: 'Revoke active sessions.',
              status: 'Waiting',
              assignee_id: null,
              order: 0,
              flagged: false,
              log_count: 2,
              start_date: null,
              due_date: null,
              end_date: null,
              created_at: '2026-06-12T09:12:00Z',
              updated_at: null,
            },
          ]),
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const tasks = await runQueryFn<CaseDetailTask[]>(
      caseTasksQueryOptions('1842'),
    )

    // Only the list — logs load lazily when a task is opened.
    expect(calls).toEqual(['cases/1842/tasks'])
    // The server's log_count becomes the list's "N logs" hint.
    expect(tasks).toMatchObject([
      { id: 'T-1842-1', apiId: 1, caseId: 1842, logs: 2 },
    ])
  })

  test('the task-logs query fans out to logs and members, only when opened', async () => {
    const calls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      const endpoint = String(input)
      calls.push(endpoint)
      const payloads: Record<string, unknown> = {
        'cases/1842/tasks/4/logs': page([
          {
            id: 1,
            public_id: 'TL-1842-4-1',
            case_id: 1842,
            task_id: 4,
            message: 'Contained.',
            created_by: 'user-1',
            created_at: '2026-06-12T10:08:00Z',
            updated_at: null,
            attachments: [],
          },
        ]),
        'organisations/origin-soc/members': [
          {
            id: 'membership-1',
            user_id: 'user-1',
            organisation_id: 'origin-soc',
            role_id: 'role-analyst',
            email: 'analyst@example.test',
            created_at: '2026-06-12T09:12:00Z',
          },
        ],
      }
      return {
        json: async () => payloads[endpoint],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const logs = await runQueryFn<CaseDetailTaskLog[]>(
      caseTaskLogsQueryOptions('1842', 4),
    )

    expect(calls).toEqual([
      'cases/1842/tasks/4/logs',
      'organisations/origin-soc/members',
    ])
    expect(logs).toMatchObject([{ apiId: 1, taskId: 4, body: 'Contained.' }])
  })

  test('creates work logs, uploads attachments, and updates existing work logs', async () => {
    const calls: Array<{ endpoint: string; options?: unknown }> = []
    vi.mocked(api.post).mockImplementation((input, options) => {
      calls.push({ endpoint: String(input), options })
      return {
        json: async () => ({
          id: 7,
          public_id: 'TL-1842-4-7',
          case_id: 1842,
          task_id: 4,
          message: '**Contained**',
          created_by: 'user-1',
          created_at: '2026-06-12T10:08:00Z',
          updated_at: null,
          attachments: [],
        }),
      } as ReturnType<typeof api.post>
    })
    vi.mocked(api.patch).mockImplementation((input, options) => {
      calls.push({ endpoint: String(input), options })
      return {
        json: async () => ({
          id: 7,
          public_id: 'TL-1842-4-7',
          case_id: 1842,
          task_id: 4,
          message: '**Contained and verified**',
          created_by: 'user-1',
          created_at: '2026-06-12T10:08:00Z',
          updated_at: '2026-06-12T10:20:00Z',
          attachments: [],
        }),
      } as ReturnType<typeof api.patch>
    })

    const file = new File(['evidence'], 'approval.pdf', {
      type: 'application/pdf',
    })

    await createTaskWorkLog({
      caseId: 1842,
      taskId: 4,
      bodyMarkdown: '**Contained**',
      files: [file],
    })
    await updateTaskWorkLog({
      caseId: 1842,
      taskId: 4,
      logId: 7,
      bodyMarkdown: '**Contained and verified**',
    })

    expect(calls[0]).toMatchObject({
      endpoint: 'cases/1842/tasks/4/logs',
      options: { json: { message: '**Contained**' } },
    })
    expect(calls[1]?.endpoint).toBe('cases/1842/tasks/4/logs/7/attachments')
    expect(
      (calls[1]?.options as { body?: FormData }).body instanceof FormData,
    ).toBe(true)
    expect(calls[2]).toMatchObject({
      endpoint: 'cases/1842/tasks/4/logs/7',
      options: { json: { message: '**Contained and verified**' } },
    })
  })
})

const casePublic = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'a case',
  description: '',
  severity: 2,
  tlp: 2,
  pap: 2,
  status: 'Open',
  flagged: false,
  assignee_id: null,
  assignee_email: null,
  tags: [],
  tasks: [],
  start_date: null,
  end_date: null,
  summary: null,
  resolution_status: null,
  impact_status: null,
  duplicate_of_case_id: null,
  merged_into: null,
  merged_from: [],
  custom_fields: {},
  created_at: '2026-06-12T09:12:00Z',
  updated_at: null,
  ...over,
})

// Invoke a queryOptions' queryFn the way react-query would, ignoring the
// context arg the fetchers don't use.
const runQueryFn = <T>(opts: { queryFn?: unknown }) =>
  (opts.queryFn as (ctx: unknown) => Promise<T>)({})

describe('case list query', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  test('serializes every filter as repeated query params and returns the page', async () => {
    let captured: URLSearchParams | undefined
    vi.mocked(api.get).mockImplementation((_input, opts) => {
      captured = (opts as { searchParams?: URLSearchParams } | undefined)
        ?.searchParams
      return {
        json: async () => ({
          items: [casePublic({ id: 7, title: 'matched' })],
          total: 42,
          skip: 10,
          limit: 10,
        }),
      } as ReturnType<typeof api.get>
    })

    const result = await runQueryFn<{ cases: unknown[]; total: number }>(
      casesQueryOptions({
        clauses: [
          { key: 'status', op: 'eq', value: 'Open' },
          { key: 'status', op: 'eq', value: 'Resolved' },
          { key: 'severity', op: 'eq', value: '3' },
          { key: 'assignee', op: 'eq', value: 'a@b.com' },
          { key: 'tag:tlp', op: 'eq', value: 'amber' },
          { key: 'title', op: 'co', value: 'consent' },
          { key: 'case', op: 'eq', value: '1842' },
        ],
        sort: 'created',
        order: 'asc',
        skip: 10,
        limit: 10,
      }),
    )

    expect(result.total).toBe(42)
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0]).toMatchObject({
      id: '#7',
      title: 'matched',
      createdAt: '2026-06-12T09:12:00Z',
      updatedAt: '2026-06-12T09:12:00Z',
    })

    const p = captured as URLSearchParams
    // Each clause becomes a repeated `filter=key~op~value` param, in order.
    expect(p.getAll('filter')).toEqual([
      'status~eq~Open',
      'status~eq~Resolved',
      'severity~eq~3',
      'assignee~eq~a@b.com',
      'tag:tlp~eq~amber',
      'title~co~consent',
      'case~eq~1842',
    ])
    expect(p.get('sort')).toBe('created')
    expect(p.get('order')).toBe('asc')
    expect(p.get('skip')).toBe('10')
    expect(p.get('limit')).toBe('10')
  })

  test('omits unset filters from the query string', async () => {
    let captured: URLSearchParams | undefined
    vi.mocked(api.get).mockImplementation((_input, opts) => {
      captured = (opts as { searchParams?: URLSearchParams } | undefined)
        ?.searchParams
      return {
        json: async () => ({ items: [], total: 0, skip: 0, limit: 10 }),
      } as ReturnType<typeof api.get>
    })

    await runQueryFn(casesQueryOptions({ sort: 'id', order: 'desc' }))

    const p = captured as URLSearchParams
    expect(p.getAll('filter')).toEqual([])
    expect(p.has('skip')).toBe(false)
  })

  test('facets query hits the filters endpoint', async () => {
    const calls: string[] = []
    vi.mocked(api.get).mockImplementation((input) => {
      calls.push(String(input))
      return {
        json: async () => ({
          assignees: ['a@b.com'],
          unassigned: true,
          tag_keys: { tlp: ['amber', 'red'] },
        }),
      } as ReturnType<typeof api.get>
    })

    const facets = await runQueryFn(caseFacetsQueryOptions())

    expect(calls).toEqual(['cases/filters'])
    // The DTO's `tag_keys` is mapped to the camelCase `tagKeys`.
    expect(facets).toEqual({
      assignees: ['a@b.com'],
      unassigned: true,
      tagKeys: { tlp: ['amber', 'red'] },
    })
  })
})
