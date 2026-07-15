/**
 * @vitest-environment jsdom
 *
 * Component test for the Case statuses settings panel: it lists the org's
 * statuses (badge + stage + built-in marker), the "Add status" dialog submits
 * `{ label, stage, color }` through the api client, deleting a custom status
 * opens a confirm dialog whose confirmation calls the delete endpoint, and a
 * built-in status offers no Delete control.
 *
 * Mocks the api client, the permissions hook (admin), and notifications.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CaseStatusesPanel } from './CaseStatusesPanel'
import { api } from '#/lib/api/client'
import type { CaseStatusPublic } from '#/components/Cases/caseStatusesQueries'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => true,
    isSuperadmin: true,
    groups: [],
    isLoaded: true,
    isLoading: false,
  }),
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const patchMock = vi.mocked(api.patch)
const deleteMock = vi.mocked(api.delete)

const STATUSES: CaseStatusPublic[] = [
  {
    id: 1,
    organisation_id: 'org-1',
    label: 'Open',
    stage: 'open',
    color: '#3b82f6',
    is_builtin: true,
    hidden: false,
    position: 0,
    created_at: '2026-07-13T00:00:00Z',
    updated_at: null,
  },
  {
    id: 5,
    organisation_id: 'org-1',
    label: 'Triaging',
    stage: 'in_progress',
    color: '#abcdef',
    is_builtin: false,
    hidden: false,
    position: 4,
    created_at: '2026-07-13T00:00:00Z',
    updated_at: null,
  },
]

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <CaseStatusesPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({ json: () => Promise.resolve(STATUSES) } as never)
  postMock.mockReset()
  postMock.mockReturnValue({
    json: () => Promise.resolve({ ...STATUSES[1], id: 6, label: 'Pending' }),
  } as never)
  patchMock.mockReset()
  patchMock.mockReturnValue({
    json: () => Promise.resolve({ ...STATUSES[0] }),
  } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
})
afterEach(() => cleanup())

describe('CaseStatusesPanel', () => {
  it('lists statuses with stage and built-in marker', async () => {
    renderPanel()
    await screen.findByText('Triaging')
    expect(screen.getByText('Built-in')).toBeTruthy()
    expect(screen.getAllByText('in_progress').length).toBeGreaterThan(0)
  })

  it('creates a status, submitting { label, stage, color }', async () => {
    renderPanel()
    await screen.findByText('Triaging')

    fireEvent.click(screen.getByRole('button', { name: /add status/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Label' }), {
      target: { value: 'Pending' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: /create status/i }),
    )

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('case-statuses', {
        json: { label: 'Pending', stage: 'in_progress', color: '#6b7280' },
      }),
    )
  })

  it('deletes a custom status through a confirm dialog', async () => {
    renderPanel()
    const row = await screen.findByTestId('case-status-row-5')
    fireEvent.click(within(row).getByRole('button', { name: /delete/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('case-statuses/5'))
  })

  it('offers no delete control for a built-in status', async () => {
    renderPanel()
    const row = await screen.findByTestId('case-status-row-1')
    expect(within(row).queryByRole('button', { name: /delete/i })).toBeNull()
  })
})
