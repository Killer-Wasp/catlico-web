/**
 * @vitest-environment jsdom
 *
 * Unit test for the `mergeCases` fetcher — it must POST to `cases/merge` with
 * the backend's `{ source_ids, case }` shape (numeric ids, snake_cased case
 * body) and map the returned survivor `CasePublic` back to a `CreatedCaseResult`.
 * Stubs at the `#/lib/api/client` boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTPError } from 'ky'
import { mergeCases } from './casesQueries'
import { api } from '#/lib/api/client'

vi.mock('#/lib/api/client', () => ({
  api: { post: vi.fn(), get: vi.fn() },
  API_BASE: '/api/v1',
}))

function survivorFixture() {
  return {
    id: 42,
    title: 'Survivor',
    description: '',
    severity: 4,
    tlp: 3,
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
    merged_from: [12, 7],
    custom_fields: {},
    created_at: new Date().toISOString(),
    updated_at: null,
    sla_due_at: null,
    sla_state: null,
  }
}

beforeEach(() => {
  vi.mocked(api.post).mockReset()
})

describe('mergeCases', () => {
  it('POSTs { source_ids, case } with numeric ids and a snake-cased case body', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.resolve(survivorFixture()),
    } as any)

    const result = await mergeCases({
      sourceIds: ['#12', '#7'],
      case: {
        title: '  Survivor  ',
        severity: 4,
        tlp: 3,
        pap: 2,
        description: '  notes  ',
        summary: 'exec summary',
        assigneeId: 'user-1',
      },
    })

    expect(api.post).toHaveBeenCalledTimes(1)
    const [path, options] = vi.mocked(api.post).mock.calls[0]
    expect(path).toBe('cases/merge')
    const body = (options as any).json
    expect(body.source_ids).toEqual([12, 7])
    expect(body.case).toEqual({
      title: 'Survivor',
      description: 'notes',
      severity: 4,
      tlp: 3,
      pap: 2,
      assignee_id: 'user-1',
      summary: 'exec summary',
    })
    expect(result.numericId).toBe(42)
    expect(result.id).toBe('#42')
  })

  it('defaults optional case fields (assignee/summary/description) when omitted', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.resolve(survivorFixture()),
    } as any)

    await mergeCases({
      sourceIds: ['#3', '#4'],
      case: { title: 'T', severity: 2, tlp: 2, pap: 2 },
    })
    const body = (vi.mocked(api.post).mock.calls[0][1] as any).json
    expect(body.case.assignee_id).toBeNull()
    expect(body.case.summary).toBeNull()
    expect(body.case.description).toBe('')
  })

  it('trims summary and sends null when it is blank after trimming', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.resolve(survivorFixture()),
    } as any)

    await mergeCases({
      sourceIds: ['#3', '#4'],
      case: { title: 'T', severity: 2, tlp: 2, pap: 2, summary: '   ' },
    })
    expect((vi.mocked(api.post).mock.calls[0][1] as any).json.case.summary).toBeNull()

    vi.mocked(api.post).mockClear()
    await mergeCases({
      sourceIds: ['#3', '#4'],
      case: { title: 'T', severity: 2, tlp: 2, pap: 2, summary: '  keep me  ' },
    })
    expect(
      (vi.mocked(api.post).mock.calls[0][1] as any).json.case.summary,
    ).toBe('keep me')
  })

  it('surfaces the FastAPI validation-array error shape as a friendly message', async () => {
    const response = new Response(
      JSON.stringify({
        detail: [
          { msg: 'field required', loc: ['body', 'case', 'title'] },
          { msg: 'value is not a valid integer', loc: ['body', 'case', 'tlp'] },
        ],
      }),
      { status: 422, headers: { 'content-type': 'application/json' } },
    )
    const httpError = new HTTPError(
      response,
      new Request('http://localhost/api/v1/cases/merge'),
      {} as any,
    )
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.reject(httpError),
    } as any)

    await expect(
      mergeCases({
        sourceIds: ['#3', '#4'],
        case: { title: '', severity: 2, tlp: 2, pap: 2 },
      }),
    ).rejects.toThrow('field required; value is not a valid integer')
  })

  it('surfaces a string `detail` (e.g. the TLP/PAP floor 422) as the error message', async () => {
    const response = new Response(
      JSON.stringify({
        detail: 'Merged case TLP/PAP cannot be less restrictive than its sources',
      }),
      { status: 422, headers: { 'content-type': 'application/json' } },
    )
    const httpError = new HTTPError(
      response,
      new Request('http://localhost/api/v1/cases/merge'),
      {} as any,
    )
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.reject(httpError),
    } as any)

    await expect(
      mergeCases({
        sourceIds: ['#3', '#4'],
        case: { title: 'T', severity: 2, tlp: 0, pap: 0 },
      }),
    ).rejects.toThrow(/less restrictive/)
  })
})
