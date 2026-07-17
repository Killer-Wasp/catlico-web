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

const navigate = vi.fn()
let routeParams: Record<string, string | undefined> = {}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackReactRouter>()
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => routeParams,
  }
})

vi.mock('#/lib/api/client', () => ({
  api: { delete: vi.fn(), get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

type JsonResponse = { json: () => Promise<unknown> }

const pageDto = {
  id: 1,
  title: 'Phishing response runbook',
  summary: 'Standard procedure for phishing.',
  tags: ['runbook', 'phishing'],
  content: '## Triage\n\n- Pull .eml\n- Capture headers',
  organisation_id: 'origin-soc',
  created_by: 'P. Nguyen',
  created_at: '2026-06-20T00:00:00Z',
  updated_at: '2026-06-21T00:00:00Z',
  contributors: [
    {
      id: 'user-1',
      email: 'analyst@example.com',
      last_edited_at: '2026-06-21T00:00:00Z',
    },
  ],
  last_edited_by: {
    id: 'user-1',
    email: 'analyst@example.com',
    last_edited_at: '2026-06-21T00:00:00Z',
  },
}

const pageDto2 = {
  id: 2,
  title: 'BEC investigation guide',
  summary: 'For confirmed BEC.',
  tags: ['bec'],
  content: 'Start here.',
  organisation_id: 'origin-soc',
  created_by: 'A. Whitford',
  created_at: '2026-06-19T00:00:00Z',
  updated_at: null,
  contributors: [],
  last_edited_by: null,
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
  navigate.mockReset()
  routeParams = {}
  vi.mocked(api.get).mockReset()
  vi.mocked(api.delete).mockReset()
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
      tags: ['runbook', 'updated'],
      content: '## Triage\n\n- Pull .eml\n- Capture headers',
    }),
  } satisfies JsonResponse as ReturnType<typeof api.patch>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ ...pageDto, id: 3, title: 'New page' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
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

  test('renders the page selector as a customized vertical tab list', async () => {
    render(<Harness />)
    await waitForPageList()

    const tabList = screen.getByRole('tablist')
    expect(tabList.getAttribute('aria-orientation')).toBe('vertical')

    const selectedTab = screen.getByRole('tab', {
      name: /Phishing response runbook/,
    })
    expect(selectedTab.getAttribute('aria-selected')).toBe('true')
  })

  test('selects the page from the numeric page id route parameter', async () => {
    routeParams = { pageId: '2' }

    render(<Harness />)

    await screen.findByRole('heading', { name: 'BEC investigation guide' })
    const selectedTab = screen.getByRole('tab', { name: /BEC investigation guide/ })
    expect(selectedTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('For confirmed BEC.')).toBeDefined()
  })

  test('navigates to the numeric page id URL when selecting a page', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByText('BEC investigation guide'))

    expect(navigate).toHaveBeenCalledWith({
      to: '/knowledge-base/$pageId',
      params: { pageId: '2' },
    })
  })

  test('renders the detail title before tags and a smaller dimmed summary', async () => {
    render(<Harness />)
    await waitForPageList()

    const title = screen.getByRole('heading', {
      name: 'Phishing response runbook',
    })
    const tag = screen.getByText('runbook')
    const summary = screen.getByText('Standard procedure for phishing.')

    expect(Boolean(title.compareDocumentPosition(tag) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(Boolean(tag.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(summary.className).toContain('mantine-Text-root')
    expect(summary.getAttribute('data-size')).toBe('sm')
    expect(summary.getAttribute('data-dimmed')).toBe('true')
    expect(screen.getByText(/Edited by analyst@example.com/)).toBeDefined()
    expect(screen.getByTestId('knowledge-base-detail-panel')).toBeDefined()
  })

  test('clicking Edit in the action menu replaces the detail view with an inline rich text editor', async () => {
    const { container } = render(<Harness />)
    await waitForPageList()

    expect(screen.queryByRole('button', { name: /edit page/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))

    await screen.findByRole('button', { name: /save changes/i })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      container.querySelector('[contenteditable="true"].ProseMirror'),
    ).not.toBeNull()

    const titleInput = screen.getByRole('textbox', {
      name: /title/i,
    })
    expect(titleInput.value).toBe('Phishing response runbook')

    const summaryInput = screen.getByRole('textbox', {
      name: /summary/i,
    })
    expect(summaryInput.value).toBe('Standard procedure for phishing.')

    expect(screen.getAllByText('runbook').length).toBeGreaterThan(0)
    expect(screen.getAllByText('phishing').length).toBeGreaterThan(0)

    const tagsInput = screen.getByRole('textbox', {
      name: /tags/i,
    })
    expect(tagsInput.value).toBe('')
  })

  test('clicking Delete in the action menu deletes the selected page and navigates to the next page', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('knowledge-base/1')
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/knowledge-base/$pageId',
      params: { pageId: '2' },
    })
  })

  test('saving the inline edit form calls PATCH with pill tags and returns to detail mode', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))
    await screen.findByRole('button', { name: /save changes/i })

    const titleInput = screen.getByRole('textbox', { name: /title/i })
    fireEvent.change(titleInput, { target: { value: 'Phishing response runbook (edited)' } })

    const summaryInput = screen.getByRole('textbox', { name: /summary/i })
    fireEvent.change(summaryInput, { target: { value: 'Updated summary.' } })

    const tagsInput = screen.getByRole('textbox', { name: /tags/i })
    fireEvent.keyDown(tagsInput, { key: 'Backspace' })
    fireEvent.change(tagsInput, { target: { value: 'updated' } })
    fireEvent.keyDown(tagsInput, { key: 'Enter' })

    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('knowledge-base/1', {
        json: {
          title: 'Phishing response runbook (edited)',
          summary: 'Updated summary.',
          tags: ['runbook', 'updated'],
          content: '## Triage\n\n- Pull .eml\n- Capture headers',
        },
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    })

    await waitFor(() => {
      expect(screen.getByText('"Phishing response runbook (edited)" saved')).toBeDefined()
    })
  })

  test('shows error notification when PATCH fails', async () => {
    vi.mocked(api.patch).mockReturnValue({
      json: async () => { throw new Error('Server error') },
    } satisfies JsonResponse as unknown as ReturnType<typeof api.patch>)

    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))
    await screen.findByRole('button', { name: /save changes/i })

    fireEvent.click(screen.getByText('Save changes'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeDefined()
    })
  })

  test('Cancel button returns to detail mode without calling the API', async () => {
    render(<Harness />)
    await waitForPageList()

    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /edit/i }))
    await screen.findByRole('button', { name: /save changes/i })

    fireEvent.click(screen.getByText('Cancel'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    })

    expect(api.patch).not.toHaveBeenCalled()
  })

  test('opens a timeline drawer and previews a version snapshot', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      if (String(input) === 'knowledge-base/1/versions') {
        return {
          json: async () => [
            {
              id: 10,
              page_id: 1,
              version_number: 2,
              action: 'update',
              snapshot: {
                title: 'Phishing response runbook',
                summary: 'Updated procedure.',
                tags: ['runbook'],
                content: '## Updated timeline content',
              },
              changed_fields: ['summary', 'content'],
              edited_by: 'user-1',
              edited_by_email: 'analyst@example.com',
              edited_at: '2026-06-21T00:00:00Z',
              reverted_from_version_id: null,
            },
          ],
        } as ReturnType<typeof api.get>
      }
      return {
        json: async () => ({ items: [pageDto, pageDto2], total: 2, skip: 0, limit: 100 }),
      } as ReturnType<typeof api.get>
    })

    render(<Harness />)
    await waitForPageList()
    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /timeline/i }))

    await screen.findByRole('dialog', { name: /timeline/i })
    expect(await screen.findByText(/Version 2/)).toBeDefined()
    expect(screen.getAllByText(/analyst@example.com/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /view version 2/i }))
    expect(await screen.findByText('Updated procedure.')).toBeDefined()
    expect(await screen.findByText(/Updated timeline content/)).toBeDefined()
  })

  test('reverts a version from the timeline drawer', async () => {
    vi.mocked(api.get).mockImplementation((input) => {
      if (String(input) === 'knowledge-base/1/versions') {
        return {
          json: async () => [
            {
              id: 10,
              page_id: 1,
              version_number: 1,
              action: 'create',
              snapshot: pageDto,
              changed_fields: ['content'],
              edited_by: 'user-1',
              edited_by_email: 'analyst@example.com',
              edited_at: '2026-06-20T00:00:00Z',
              reverted_from_version_id: null,
            },
          ],
        } as ReturnType<typeof api.get>
      }
      return {
        json: async () => ({ items: [pageDto, pageDto2], total: 2, skip: 0, limit: 100 }),
      } as ReturnType<typeof api.get>
    })
    vi.mocked(api.post).mockReturnValue({
      json: async () => pageDto,
    } as ReturnType<typeof api.post>)

    render(<Harness />)
    await waitForPageList()
    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /timeline/i }))
    fireEvent.click(await screen.findByRole('button', { name: /revert version 1/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('knowledge-base/1/versions/10/revert')
    })
  })

  test('renders a contributors line from the page contributors', async () => {
    render(<Harness />)
    await waitForPageList()

    expect(screen.getByText(/Contributors:\s*analyst@example.com/)).toBeDefined()
  })

  test('exporting a page fetches the document and downloads it as JSON', async () => {
    const exportDocument = {
      page: pageDto,
      versions: [
        {
          id: 10,
          page_id: 1,
          version_number: 1,
          action: 'create',
          snapshot: pageDto,
          changed_fields: ['content'],
          edited_by: 'user-1',
          edited_by_email: 'analyst@example.com',
          edited_at: '2026-06-20T00:00:00Z',
          reverted_from_version_id: null,
        },
      ],
    }
    vi.mocked(api.get).mockImplementation((input) => {
      if (String(input) === 'knowledge-base/1/export') {
        return { json: async () => exportDocument } as ReturnType<typeof api.get>
      }
      return {
        json: async () => ({ items: [pageDto, pageDto2], total: 2, skip: 0, limit: 100 }),
      } as ReturnType<typeof api.get>
    })
    const createObjectURL = vi.fn(() => 'blob:kb')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectURL })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    render(<Harness />)
    await waitForPageList()
    fireEvent.click(screen.getByRole('button', { name: /page actions/i }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /export/i }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('knowledge-base/1/export')
    })
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled()
    })
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:kb')
    clickSpy.mockRestore()
  })

  test('importing a JSON file posts the document and navigates to the new page', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async () => ({ ...pageDto, id: 42, title: 'Imported page' }),
    } as ReturnType<typeof api.post>)

    const { container } = render(<Harness />)
    await waitForPageList()

    const document = { page: { title: 'Imported page', content: 'body' }, versions: [] }
    const file = new File([JSON.stringify(document)], 'page.json', {
      type: 'application/json',
    })
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('knowledge-base/import', { json: document })
    })
    expect(navigate).toHaveBeenCalledWith({
      to: '/knowledge-base/$pageId',
      params: { pageId: '42' },
    })
  })
})
