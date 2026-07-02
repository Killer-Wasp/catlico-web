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
  within,
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
    {
      id: 'task-template-2',
      title: 'Contain account',
      group: 'Containment',
      description: 'Disable suspicious sessions.',
      order: 1,
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
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:case-template-json'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
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
      screen.getByDisplayValue('Use for reported credential lures.'),
    ).toBeDefined()
    expect(
      screen.getByRole('combobox', { name: 'Severity' }).getAttribute('value'),
    ).toBe('HIGH')
    expect(screen.getAllByText('Triage').length).toBeGreaterThan(0)
  })

  test('lays out the basics fields with name and id sharing the first row', async () => {
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()

    const nameIdRow = screen.getByTestId('template-name-id-row')
    expect(within(nameIdRow).getByLabelText('Case Template Name')).toBeDefined()
    expect(within(nameIdRow).getByLabelText('Id')).toBeDefined()
    expect(nameIdRow.getAttribute('style')).toContain('7fr')
    expect(nameIdRow.getAttribute('style')).toContain('3fr')
    expect(screen.getByLabelText('Case Template Description')).toBeDefined()

    const pageText = document.body.textContent
    expect(pageText.indexOf('Case Template Description')).toBeLessThan(
      pageText.indexOf('Case title prefix'),
    )
  })

  test('renders template tasks as an ordered table with row actions', async () => {
    render(<Harness />)

    const table = await screen.findByRole('table', {
      name: 'Template tasks',
    })
    const triageRow = within(table).getByRole('row', { name: /1 Triage/i })

    expect(
      within(table).getByRole('columnheader', { name: 'Order' }),
    ).toBeDefined()
    expect(
      within(table).getByRole('columnheader', { name: 'Task' }),
    ).toBeDefined()
    expect(
      within(triageRow).getByRole('button', { name: 'Drag task 1' }),
    ).toBeDefined()
    expect(
      within(triageRow).getByRole('button', { name: 'Actions for task 1' }),
    ).toBeDefined()
  })

  test('renders custom fields in a table when fields are added', async () => {
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '+ Add field' }))

    const table = screen.getByRole('table', { name: 'Custom fields' })
    expect(
      within(table).getByRole('columnheader', { name: 'Label' }),
    ).toBeDefined()
    expect(
      within(table).getByRole('columnheader', { name: 'Type' }),
    ).toBeDefined()
    expect(within(table).getByLabelText('Custom field 1 label')).toBeDefined()
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

    fireEvent.change(screen.getByLabelText('Case Template Name'), {
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
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    render(<Harness />)

    expect(
      await screen.findByDisplayValue('Phishing / credential harvesting'),
    ).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('case-templates/7/export'),
    )
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClick).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:case-template-json')
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    anchorClick.mockRestore()
  })
})
