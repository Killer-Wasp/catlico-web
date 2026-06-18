import {
  caseFacetsQueryOptions,
  casesQueryOptions,
  fetchCaseDetail,
} from '#/components/Cases/casesQueries'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  skip: 0,
  limit: 100,
})

describe('case detail queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  test('fetches a case detail by fanning out to backend child-resource endpoints', async () => {
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
        'cases/1842/tasks': page([]),
        'cases/1842/observables': page([]),
        'cases/1842/comments': page([]),
        'cases/1842/activity': page([]),
      }
      return {
        json: async () => payloads[endpoint],
      } satisfies JsonResponse as ReturnType<typeof api.get>
    })

    const detail = await fetchCaseDetail('1842')

    expect(calls).toEqual([
      'cases/1842',
      'cases/1842/tasks',
      'cases/1842/observables',
      'cases/1842/comments',
      'cases/1842/activity',
    ])
    expect(detail).toMatchObject({
      id: '#1842',
      title: 'OAuth consent grant',
      assignee: 'Unassigned',
      tasks: [],
      observables: [],
      comments: [],
      timeline: [],
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
const runQueryFn = <T,>(opts: { queryFn?: unknown }) =>
  (opts.queryFn as (ctx: unknown) => Promise<T>)({})

describe('case list query', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  test('serializes every filter as repeated query params and returns the page', async () => {
    let captured: URLSearchParams | undefined
    vi.mocked(api.get).mockImplementation(
      (_input, opts?: { searchParams?: URLSearchParams }) => {
        captured = opts?.searchParams
        return {
          json: async () => ({
            items: [casePublic({ id: 7, title: 'matched' })],
            total: 42,
            skip: 10,
            limit: 10,
          }),
        } as ReturnType<typeof api.get>
      },
    )

    const result = await runQueryFn<{ cases: unknown[]; total: number }>(
      casesQueryOptions({
        status: ['Open', 'Resolved'],
        severity: [3, 4],
        assignee: ['a@b.com', 'Unassigned'],
        tag: ['phishing'],
        title: ['consent'],
        case: ['1842'],
        sort: 'created',
        order: 'asc',
        skip: 10,
        limit: 10,
      }),
    )

    expect(result.total).toBe(42)
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0]).toMatchObject({ id: '#7', title: 'matched' })

    const p = captured as URLSearchParams
    expect(p.getAll('status_filter')).toEqual(['Open', 'Resolved'])
    expect(p.getAll('severity')).toEqual(['3', '4'])
    expect(p.getAll('assignee')).toEqual(['a@b.com', 'Unassigned'])
    expect(p.getAll('tag')).toEqual(['phishing'])
    expect(p.getAll('title')).toEqual(['consent'])
    expect(p.getAll('case_q')).toEqual(['1842'])
    expect(p.get('sort')).toBe('created')
    expect(p.get('order')).toBe('asc')
    expect(p.get('skip')).toBe('10')
    expect(p.get('limit')).toBe('10')
  })

  test('omits unset filters from the query string', async () => {
    let captured: URLSearchParams | undefined
    vi.mocked(api.get).mockImplementation(
      (_input, opts?: { searchParams?: URLSearchParams }) => {
        captured = opts?.searchParams
        return {
          json: async () => ({ items: [], total: 0, skip: 0, limit: 10 }),
        } as ReturnType<typeof api.get>
      },
    )

    await runQueryFn(casesQueryOptions({ sort: 'id', order: 'desc' }))

    const p = captured as URLSearchParams
    expect(p.getAll('status_filter')).toEqual([])
    expect(p.getAll('tag')).toEqual([])
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
          tags: ['phishing'],
        }),
      } as ReturnType<typeof api.get>
    })

    const facets = await runQueryFn(caseFacetsQueryOptions())

    expect(calls).toEqual(['cases/filters'])
    expect(facets).toEqual({
      assignees: ['a@b.com'],
      unassigned: true,
      tags: ['phishing'],
    })
  })
})
