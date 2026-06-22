import {
  caseTemplateQueryOptions,
  caseTemplatesQueryOptions,
  createCaseTemplate,
  deleteCaseTemplate,
  duplicateCaseTemplate,
  exportCaseTemplate,
  fetchCaseTemplate,
  fetchCaseTemplates,
  importCaseTemplate,
  updateCaseTemplate,
} from '#/components/Cases/caseTemplatesQueries'
import { api } from '#/lib/api/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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

const templateDto = {
  id: 7,
  name: 'phishing-playbook',
  display_name: 'Phishing / credential harvesting',
  title_prefix: '[Phishing] ',
  description: 'Standard phishing playbook.',
  severity: 3,
  tlp: 2,
  pap: 2,
  summary: 'Use for reported credential lures.',
  organisation_id: 'org-1',
  tasks: [
    {
      id: 'task-template-1',
      title: 'Triage',
      group: 'Triage',
      description: 'Confirm scope.',
      order: 0,
    },
  ],
  tags: ['phishing', 'T1566'],
  created_at: '2026-06-12T09:21:00Z',
  updated_at: '2026-06-12T10:21:00Z',
}

describe('case template queries', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.put).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  test('fetches and maps backend case templates', async () => {
    vi.mocked(api.get).mockReturnValue({
      json: async () => page([templateDto]),
    } satisfies JsonResponse as ReturnType<typeof api.get>)

    const result = await fetchCaseTemplates()

    expect(api.get).toHaveBeenCalledWith('case-templates/', {
      searchParams: { limit: '100', skip: '0' },
    })
    expect(result).toEqual({
      templates: [
        {
          id: '7',
          apiId: 7,
          slug: 'phishing-playbook',
          name: 'Phishing / credential harvesting',
          builtin: false,
          updated: expect.any(String),
          description: 'Standard phishing playbook.',
          prefix: '[Phishing] ',
          assignee: '',
          sev: 3,
          tlp: 2,
          pap: 2,
          tags: ['phishing', 'T1566'],
          tasks: [
            {
              title: 'Triage',
              group: 'Triage',
              description: 'Confirm scope.',
              assignee: '',
              dueInHours: 0,
              flagged: false,
            },
          ],
          customFields: [],
          summary: 'Use for reported credential lures.',
        },
      ],
      total: 1,
    })
  })

  test('fetches one template by backend id', async () => {
    vi.mocked(api.get).mockReturnValue({
      json: async () => templateDto,
    } satisfies JsonResponse as ReturnType<typeof api.get>)

    const result = await fetchCaseTemplate('7')

    expect(api.get).toHaveBeenCalledWith('case-templates/7')
    expect(result.id).toBe('7')
    expect(result.name).toBe('Phishing / credential harvesting')
  })

  test('creates, updates, tags, duplicates, imports, exports, and deletes templates', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => templateDto,
    } satisfies JsonResponse as ReturnType<typeof api.post>)
    vi.mocked(api.patch).mockReturnValue({
      json: async () => templateDto,
    } satisfies JsonResponse as ReturnType<typeof api.patch>)
    vi.mocked(api.put).mockReturnValue({
      json: async () => ['phishing', 'T1566'],
    } satisfies JsonResponse as ReturnType<typeof api.put>)
    vi.mocked(api.get).mockReturnValue({
      json: async () => ({
        kind: 'catlico.caseTemplate',
        version: 1,
        name: 'phishing-playbook',
        tags: ['phishing'],
      }),
    } satisfies JsonResponse as ReturnType<typeof api.get>)
    vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)

    await createCaseTemplate({
      ...resultTemplate(),
      id: 'phishing-playbook',
      apiId: undefined,
      slug: 'phishing-playbook',
    })
    expect(api.post).toHaveBeenCalledWith('case-templates/', {
      json: expect.objectContaining({
        name: 'phishing-playbook',
        display_name: 'Phishing / credential harvesting',
        title_prefix: '[Phishing] ',
      }),
    })
    expect(api.put).toHaveBeenCalledWith('case-templates/7/tags', {
      json: { tags: ['phishing', 'T1566'] },
    })

    await updateCaseTemplate(resultTemplate())
    expect(api.patch).toHaveBeenCalledWith('case-templates/7', {
      json: expect.objectContaining({
        display_name: 'Phishing / credential harvesting',
        tasks: [
          {
            title: 'Triage',
            group: 'Triage',
            description: 'Confirm scope.',
            order: 0,
          },
        ],
      }),
    })

    await duplicateCaseTemplate(resultTemplate())
    expect(api.post).toHaveBeenCalledTimes(2)

    const exported = await exportCaseTemplate('7')
    expect(api.get).toHaveBeenCalledWith('case-templates/7/export')
    expect(exported.kind).toBe('catlico.caseTemplate')

    await importCaseTemplate({
      kind: 'catlico.caseTemplate',
      version: 1,
      name: 'shared',
      tasks: [],
      tags: [],
    })
    expect(api.post).toHaveBeenCalledWith('case-templates/import', {
      json: expect.objectContaining({ name: 'shared' }),
    })

    await deleteCaseTemplate('7')
    expect(api.delete).toHaveBeenCalledWith('case-templates/7')
  })

  test('uses stable query keys', () => {
    expect(caseTemplatesQueryOptions().queryKey).toEqual([
      'case-templates',
      'list',
      { limit: 100, skip: 0 },
    ])
    expect(caseTemplateQueryOptions('7').queryKey).toEqual([
      'case-templates',
      'detail',
      '7',
    ])
  })
})

function resultTemplate() {
  return {
    id: '7',
    apiId: 7,
    slug: 'phishing-playbook',
    name: 'Phishing / credential harvesting',
    builtin: false,
    updated: '10:21',
    description: 'Standard phishing playbook.',
    prefix: '[Phishing] ',
    assignee: '',
    sev: 3 as const,
    tlp: 2 as const,
    pap: 2 as const,
    tags: ['phishing', 'T1566'],
    tasks: [
      {
        title: 'Triage',
        group: 'Triage',
        description: 'Confirm scope.',
        assignee: '',
        dueInHours: 0,
        flagged: false,
      },
    ],
    customFields: [],
    summary: 'Use for reported credential lures.',
  }
}
