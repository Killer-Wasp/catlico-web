// @vitest-environment jsdom
import { CaseTemplateEditorPage } from '#/components/pages/CaseTemplateEditorPage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

const navigate = vi.fn()

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}))

type JsonResponse = {
  json: () => Promise<unknown>
}

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

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

function Harness({ templateId = '7' }: { templateId?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <CaseTemplateEditorPage templateId={templateId} />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  navigate.mockReset()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.get).mockImplementation(
    (input) =>
      ({
        json: async () =>
          String(input).endsWith('/export')
            ? {
                kind: 'catlico.caseTemplate',
                version: 1,
                name: 'phishing-playbook',
                tags: ['phishing'],
              }
            : templateDto,
      }) satisfies JsonResponse as ReturnType<typeof api.get>,
  )
  vi.mocked(api.patch).mockReturnValue({
    json: async () => templateDto,
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ ...templateDto, id: 9, name: 'new-template' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => templateDto.tags,
  } satisfies JsonResponse as ReturnType<typeof api.put>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(cleanup)

describe('CaseTemplateEditorPage', () => {
  test('loads a backend template item into the editor', async () => {
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()
    expect(api.get).toHaveBeenCalledWith('case-templates/7')
    expect(screen.getByDisplayValue('phishing-playbook')).toBeDefined()
    expect(
      screen.getByDisplayValue('Standard phishing playbook.'),
    ).toBeDefined()
    expect(
      screen.getByRole('radio', { name: 'HIGH' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getAllByDisplayValue('Triage').length).toBeGreaterThan(0)
  })

  test('saves edits and template tags to the backend', async () => {
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()
    fireEvent.change(
      screen.getByDisplayValue('Phishing / credential harvesting'),
      {
        target: { value: 'Updated phishing playbook' },
      },
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Save template' })[0])

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        'case-templates/7',
        expect.objectContaining({
          json: expect.objectContaining({
            display_name: 'Updated phishing playbook',
          }),
        }),
      ),
    )
    expect(api.put).toHaveBeenCalledWith('case-templates/7/tags', {
      json: { tags: ['phishing', 'T1566'] },
    })
  })

  test('creates a new template through the backend', async () => {
    render(<Harness templateId="new" />)

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'New response template' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save template' })[0])

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        'case-templates/',
        expect.objectContaining({
          json: expect.objectContaining({
            name: 'new-response-template',
            display_name: 'New response template',
          }),
        }),
      ),
    )
  })

  test('exports template JSON from the backend', async () => {
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('case-templates/7/export'),
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"kind": "catlico.caseTemplate"'),
    )
  })
})
