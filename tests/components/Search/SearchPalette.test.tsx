// @vitest-environment jsdom
import { SearchPalette } from '#/components/Search/SearchPalette'
import type { SearchResponse } from '#/lib/search'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

const { navigateMock, apiGetMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  apiGetMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

// Mock only the actual I/O boundary (the ky client), not '#/lib/search'.
// `searchQueryOptions`'s queryFn closes over `fetchSearch` from within
// search.ts's own module scope — a `vi.mock('#/lib/search', ...)` override of
// `fetchSearch` would NOT be visible to that internal call (the real
// `searchQueryOptions`, pulled in via `importOriginal`, still references the
// real `fetchSearch` binding from the same module instance). Mocking `api`
// instead lets the real `fetchSearch`, real `searchQueryOptions`, and the
// real `SearchPalette` render/tab logic all run for true.
vi.mock('#/lib/api/client', () => ({
  api: { get: apiGetMock },
}))

const emptyResults: SearchResponse['results'] = {
  case: [],
  alert: [],
  observable: [],
  observable_groups: [],
  task: [],
  comment: [],
  knowledge_base: [],
  attachment: [],
}

function buildResponse(over: Partial<SearchResponse['results']>): SearchResponse {
  const results = { ...emptyResults, ...over }
  return {
    counts: {
      case: results.case.length,
      alert: results.alert.length,
      observable: results.observable_groups.length,
      task: results.task.length,
      comment: results.comment.length,
      knowledge_base: results.knowledge_base.length,
      attachment: results.attachment.length,
    },
    results,
  }
}

function setResponse(resp: SearchResponse) {
  apiGetMock.mockReturnValue({ json: () => Promise.resolve(resp) })
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
})

beforeEach(() => {
  navigateMock.mockReset()
  apiGetMock.mockReset()
})

afterEach(cleanup)

function renderPalette() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <SearchPalette initiallyOpened initialQuery="phish" />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

const KB_HIT = { id: 42, title: 'Onboarding Runbook', snippet: 'reset <mark>vpn</mark> access' }
const ATTACHMENT_HIT = {
  id: 7,
  public_id: 'A-99-7',
  case_id: 99,
  attachment_id: 'uuid-abc',
  name: 'evidence.pdf',
}

describe('SearchPalette', () => {
  test('shows tab counts and grouped observable rows', async () => {
    setResponse(
      buildResponse({
        case: [
          {
            id: 1,
            title: 'Phishing wave',
            snippet: '<mark>Phish</mark>ing wave',
            status: { id: 1, label: 'Open', stage: 'open', color: '#3b82f6' },
            severity: 2,
            updated_at: null,
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 2,
            title: 'Phish kit',
            snippet: '<mark>Phish</mark> kit',
            status: { id: 1, label: 'Open', stage: 'open', color: '#3b82f6' },
            severity: 3,
            updated_at: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        observable_groups: [{ observable_type: 'ip', data: '10.0.0.1', occurrences: 3 }],
      }),
    )
    renderPalette()
    await waitFor(() => expect(screen.getByText('Phishing wave')).toBeDefined())
    expect(screen.getByText(/Cases.*2/)).toBeDefined()
    expect(screen.getByText(/10\.0\.0\.1/)).toBeDefined()
    expect(screen.getByText(/3 occurrences/)).toBeDefined()
  })

  test('renders a Knowledge base row with title and highlighted snippet', async () => {
    setResponse(buildResponse({ knowledge_base: [KB_HIT] }))
    renderPalette()
    await waitFor(() => expect(screen.getByText('Onboarding Runbook')).toBeDefined())
    // <mark>vpn</mark> is rendered as text inside a highlight mark, never HTML.
    expect(screen.getByText('vpn', { selector: 'mark' })).toBeDefined()
  })

  test('renders an Attachments row with filename and parent-case hint', async () => {
    setResponse(buildResponse({ attachment: [ATTACHMENT_HIT] }))
    renderPalette()
    await waitFor(() => expect(screen.getByText('evidence.pdf')).toBeDefined())
    expect(screen.getByText(/Case #99/)).toBeDefined()
  })

  test('navigates to the knowledge-base page when a KB row is selected', async () => {
    setResponse(buildResponse({ knowledge_base: [KB_HIT] }))
    renderPalette()
    await waitFor(() => expect(screen.getByText('Onboarding Runbook')).toBeDefined())
    fireEvent.click(screen.getByText('Onboarding Runbook'))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/knowledge-base/$pageId',
      params: { pageId: '42' },
    })
  })

  test('navigates to the parent case attachments tab when an attachment row is selected', async () => {
    setResponse(buildResponse({ attachment: [ATTACHMENT_HIT] }))
    renderPalette()
    await waitFor(() => expect(screen.getByText('evidence.pdf')).toBeDefined())
    fireEvent.click(screen.getByText('evidence.pdf'))
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/cases/$caseId/$tab',
      params: { caseId: '99', tab: 'attachments' },
    })
  })

  test('renders no rows for empty knowledge_base and attachment buckets', async () => {
    setResponse(
      buildResponse({
        case: [
          {
            id: 1,
            title: 'Phishing wave',
            snippet: '<mark>Phish</mark>ing wave',
            status: { id: 1, label: 'Open', stage: 'open', color: '#3b82f6' },
            severity: 2,
            updated_at: null,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    renderPalette()
    await waitFor(() => expect(screen.getByText('Phishing wave')).toBeDefined())
    expect(screen.queryByText('Onboarding Runbook')).toBeNull()
    expect(screen.queryByText('evidence.pdf')).toBeNull()
  })
})
