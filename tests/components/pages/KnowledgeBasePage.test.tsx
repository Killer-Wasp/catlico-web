// @vitest-environment jsdom
import { KnowledgeBasePage } from '#/components/pages/KnowledgeBasePage'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as TanStackReactRouter from '@tanstack/react-router'
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

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const pageDto = {
  id: 1,
  title: 'Phishing response runbook',
  summary: 'Standard procedure for phishing.',
  tags: ['runbook', 'phishing'],
  blocks: [
    { type: 'section' as const, title: 'Triage', items: ['Pull .eml', 'Capture headers'] },
  ],
  organisation_id: 'origin-soc',
  created_by: 'P. Nguyen',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: '2026-06-21T00:00:00Z',
}

const pageDto2 = {
  id: 2,
  title: 'BEC investigation guide',
  summary: 'For confirmed BEC.',
  tags: ['bec'],
  blocks: [{ type: 'paragraph' as const, text: 'Start here.' }],
  organisation_id: 'origin-soc',
  created_by: 'A. Whitford',
  created_at: '2026-06-19T00:00:00Z',
  updated_at: null,
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
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
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

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <KnowledgeBasePage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({ items: [pageDto, pageDto2], total: 2, skip: 0, limit: 100 }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.patch).mockReturnValue({
    json: async () => ({
      ...pageDto,
      title: 'Phishing response runbook (edited)',
      summary: 'Updated summary.',
      tags: ['runbook', 'phishing', 'updated'],
      blocks: [{ type: 'section', title: 'Triage', items: ['Pull .eml', 'Capture headers', 'New step'] }],
    }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ ...pageDto, id: 3, title: 'New page' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
})

afterEach(cleanup)

async function waitForPageList() {
  const items = await screen.findAllByText('Phishing response runbook')
  expect(items.length).toBeGreaterThan(0)
}

describe('KnowledgeBasePage', () => {
  test('renders page list and detail from the backend', async () => {
    render(<Harness />)
    await waitForPageList()
    expect(screen.getByText('BEC investigation guide')).toBeDefined()
    expect(api.get).toHaveBeenCalledWith('knowledge-base/')
  })

  test('clicking Edit page opens editable fields pre-filled with page data', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByText('Edit page'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeDefined()

    const titleInput = screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement
    expect(titleInput.value).toBe('Phishing response runbook')

    const summaryInput = screen.getByRole('textbox', { name: /summary/i }) as HTMLInputElement
    expect(summaryInput.value).toBe('Standard procedure for phishing.')

    const tagsInput = screen.getByRole('textbox', { name: /tags/i }) as HTMLInputElement
    expect(tagsInput.value).toBe('runbook, phishing')
  })

  test('saving the edit form calls PATCH with changed values and closes the modal', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByText('Edit page'))
    await screen.findByRole('dialog')

    const titleInput = screen.getByRole('textbox', { name: /title/i })
    fireEvent.change(titleInput, { target: { value: 'Phishing response runbook (edited)' } })

    const summaryInput = screen.getByRole('textbox', { name: /summary/i })
    fireEvent.change(summaryInput, { target: { value: 'Updated summary.' } })

    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('knowledge-base/1', {
        json: {
          title: 'Phishing response runbook (edited)',
          summary: 'Updated summary.',
          tags: ['runbook', 'phishing'],
          blocks: [{ type: 'section', title: 'Triage', items: ['Pull .eml', 'Capture headers'] }],
        },
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    await waitFor(() => {
      expect(screen.getByText('"Phishing response runbook (edited)" saved')).toBeDefined()
    })
  })

  test('shows error notification when PATCH fails', async () => {
    vi.mocked(api.patch).mockReturnValue({
      json: async () => { throw new Error('Server error') },
    } satisfies JsonResponse as ReturnType<typeof api.patch>)

    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByText('Edit page'))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined()
    })
  })

  test('Cancel button closes the modal without calling the API', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByText('Edit page'))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    expect(api.patch).not.toHaveBeenCalled()
  })
})
