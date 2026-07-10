// @vitest-environment jsdom
import { SearchPalette } from '#/components/Search/SearchPalette'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
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
  api: {
    get: vi.fn(() => ({
      json: () =>
        Promise.resolve({
          counts: { case: 2, alert: 0, observable: 1, task: 0, comment: 0 },
          results: {
            case: [
              {
                id: 1,
                title: 'Phishing wave',
                snippet: '<mark>Phish</mark>ing wave',
                status: 'Open',
                severity: 2,
                updated_at: null,
                created_at: '2026-01-01T00:00:00Z',
              },
              {
                id: 2,
                title: 'Phish kit',
                snippet: '<mark>Phish</mark> kit',
                status: 'Open',
                severity: 3,
                updated_at: null,
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
            alert: [],
            observable: [],
            observable_groups: [
              { observable_type: 'ip', data: '10.0.0.1', occurrences: 3 },
            ],
            task: [],
            comment: [],
          },
        }),
    })),
  },
}))

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

describe('SearchPalette', () => {
  test('shows tab counts and grouped observable rows', async () => {
    renderPalette()
    await waitFor(() => expect(screen.getByText('Phishing wave')).toBeDefined())
    expect(screen.getByText(/Cases.*2/)).toBeDefined()
    expect(screen.getByText(/10\.0\.0\.1/)).toBeDefined()
    expect(screen.getByText(/3 occurrences/)).toBeDefined()
  })
})
