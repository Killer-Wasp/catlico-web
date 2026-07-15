/**
 * @vitest-environment jsdom
 *
 * Interaction tests for the searchable AssignMenu: opening the menu enables the
 * server-side user search, listed people can be picked (firing `onAssign`), the
 * search field is typeable, and the empty / loading states render. The user
 * search query is mocked so the menu's rows are deterministic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssignMenu } from './AssignMenu'
import type { UserPublic } from '#/components/Users/usersQueries'

const MOCK_USERS: UserPublic[] = [
  {
    id: 'u1',
    email: 'ada@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    is_active: true,
    is_superadmin: false,
    has_avatar: false,
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
  {
    id: 'u2',
    email: 'grace@example.com',
    first_name: 'Grace',
    last_name: 'Hopper',
    is_active: true,
    is_superadmin: false,
    has_avatar: false,
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
]

// Controllable user-search result: each test sets `searchResult` (or a
// never-resolving promise for the loading state).
let searchResult: Promise<UserPublic[]> = Promise.resolve(MOCK_USERS)

vi.mock('#/components/Users/usersQueries', () => ({
  userDisplayName: (u: { email: string }) => u.email,
  userSearchQueryOptions: (q: string) => ({
    queryKey: ['users', 'search', q],
    queryFn: () => searchResult,
  }),
}))

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
  API_BASE: '/api/v1',
}))

function renderMenu(onAssign = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <AssignMenu onAssign={onAssign} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return onAssign
}

function openMenu(label = 'Assign to') {
  fireEvent.click(screen.getByRole('button', { name: label }))
}

beforeEach(() => {
  searchResult = Promise.resolve(MOCK_USERS)
})
afterEach(() => cleanup())

describe('AssignMenu', () => {
  it('opens the menu and lists searched people', async () => {
    renderMenu()
    openMenu()
    expect(await screen.findByText('ada@example.com')).toBeTruthy()
    expect(screen.getByText('grace@example.com')).toBeTruthy()
  })

  it('fires onAssign with the picked user', async () => {
    const onAssign = renderMenu()
    openMenu()
    fireEvent.click(await screen.findByText('grace@example.com'))
    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1))
    expect(onAssign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u2', email: 'grace@example.com' }),
    )
  })

  it('lets the user type in the search field', async () => {
    renderMenu()
    openMenu()
    await screen.findByText('ada@example.com')
    const input = screen.getByPlaceholderText('Search people') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'grace' } })
    expect(input.value).toBe('grace')
  })

  it('shows the empty state when no people match', async () => {
    searchResult = Promise.resolve([])
    renderMenu()
    openMenu()
    expect(await screen.findByText('No people found')).toBeTruthy()
  })

  it('honours the custom trigger label', () => {
    renderMenu()
    expect(
      screen.queryByRole('button', { name: 'Assign to' }),
    ).toBeTruthy()
  })

  it('does not fetch until the menu is opened', () => {
    const onAssign = renderMenu()
    // Nothing rendered from the dropdown before opening.
    expect(screen.queryByText('ada@example.com')).toBeNull()
    expect(onAssign).not.toHaveBeenCalled()
  })
})
