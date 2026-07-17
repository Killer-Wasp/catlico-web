// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SearchResponse } from '#/lib/search'
import { recordRecentlyViewed } from '#/lib/recentlyViewed'
import { SearchPalette } from '#/components/Search/SearchPalette'

const hoisted = vi.hoisted(() => ({
  data: undefined as SearchResponse | undefined,
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => hoisted.navigate,
}))

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (o: unknown) => o,
  keepPreviousData: Symbol('keepPreviousData'),
  useQuery: () => ({ data: hoisted.data, isError: false, refetch: vi.fn() }),
}))

function renderPalette(initialQuery = '') {
  return render(
    <MantineProvider>
      <SearchPalette initiallyOpened initialQuery={initialQuery} />
    </MantineProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  hoisted.data = undefined
  hoisted.navigate.mockClear()
})

afterEach(() => cleanup())

describe('SearchPalette empty state', () => {
  test('renders recently-viewed rows and navigates on select', () => {
    recordRecentlyViewed({
      type: 'case',
      id: '7',
      label: 'Phishing campaign',
      route: {
        to: '/cases/$caseId/$tab',
        params: { caseId: '7', tab: 'details' },
      },
    })
    recordRecentlyViewed({
      type: 'alert',
      id: '3',
      label: 'Suspicious login',
      route: { to: '/alerts/$alertId', params: { alertId: '3' } },
    })
    renderPalette('')

    // Most-recent-first: the alert we recorded last is on top.
    expect(screen.getByText('Suspicious login')).toBeInTheDocument()
    const caseRow = screen.getByText('Phishing campaign')
    expect(caseRow).toBeInTheDocument()

    fireEvent.click(caseRow)
    expect(hoisted.navigate).toHaveBeenCalledWith({
      to: '/cases/$caseId/$tab',
      params: { caseId: '7', tab: 'details' },
    })
  })

  test('with an empty buffer keeps the type-to-search hint', () => {
    renderPalette('')
    const hint = screen.getByText(/Type to search/i)
    expect(hint).toHaveTextContent(/knowledge base/i)
    expect(hint).toHaveTextContent(/attachments/i)
  })

  test('the search input copy mentions knowledge base and attachments', () => {
    renderPalette('')
    const input = screen.getByLabelText(/knowledge base/i)
    const placeholder = (input.getAttribute('placeholder') ?? '').toLowerCase()
    expect(placeholder).toContain('attachments')
  })
})

describe('SearchPalette result rendering', () => {
  test('an attachment hit still renders (N1 regression)', () => {
    hoisted.data = {
      counts: {
        case: 0,
        alert: 0,
        observable: 0,
        task: 0,
        comment: 0,
        knowledge_base: 0,
        attachment: 1,
      },
      results: {
        case: [],
        alert: [],
        observable: [],
        observable_groups: [],
        task: [],
        comment: [],
        knowledge_base: [],
        attachment: [
          {
            id: 5,
            public_id: 'ATT-5',
            case_id: 11,
            attachment_id: 'a5',
            name: 'evidence.pdf',
          },
        ],
      },
    }
    renderPalette('evidence')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('evidence.pdf')).toBeInTheDocument()
  })
})
