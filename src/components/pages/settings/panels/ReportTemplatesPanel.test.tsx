/**
 * @vitest-environment jsdom
 *
 * Component test for the Report templates settings panel: it lists templates
 * (name + description), the "New template" dialog submits
 * `{ name, description, content_md }` through the api client, and deleting a
 * template opens a confirm dialog whose confirmation calls the delete endpoint.
 *
 * Mocks the api client (get/post/delete), the permissions hook (admin), and the
 * notifications module.
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
import { ReportTemplatesPanel } from './ReportTemplatesPanel'
import { api } from '#/lib/api/client'
import type { ReportTemplatePublic } from '#/components/pages/settings/settingsQueries'

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

vi.mock('#/lib/auth/session', () => ({
  getActiveOrgId: () => 'org-1',
  getSessionOrganisationIds: () => ['org-1'],
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const patchMock = vi.mocked(api.patch)
const deleteMock = vi.mocked(api.delete)

const TEMPLATES: ReportTemplatePublic[] = [
  {
    id: 't-1',
    name: 'Incident summary',
    description: 'Exec-facing incident write-up',
    content_md: '# {{ title }}',
    config: {},
    organisation_id: 'org-1',
    created_at: '2026-07-13T00:00:00Z',
    updated_at: null,
  },
]

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <ReportTemplatesPanel />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { invalidateSpy }
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({ json: () => Promise.resolve(TEMPLATES) } as never)
  postMock.mockReset()
  postMock.mockReturnValue({
    json: () => Promise.resolve({ ...TEMPLATES[0], id: 't-2' }),
  } as never)
  patchMock.mockReset()
  patchMock.mockReturnValue({
    json: () => Promise.resolve({ ...TEMPLATES[0] }),
  } as never)
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
})
afterEach(() => cleanup())

describe('ReportTemplatesPanel', () => {
  it('lists templates by name and description', async () => {
    renderPanel()
    await screen.findByText('Incident summary')
    expect(screen.getByText('Exec-facing incident write-up')).toBeTruthy()
  })

  it('creates a template, submitting { name, description, content_md } and invalidating the list', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('Incident summary')

    fireEvent.click(screen.getByRole('button', { name: /new template/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/name/i), {
      target: { value: 'Weekly report' },
    })
    fireEvent.change(within(dialog).getByLabelText(/description/i), {
      target: { value: 'Weekly rollup' },
    })
    fireEvent.change(within(dialog).getByLabelText(/template/i), {
      target: { value: '# {{ title }}\n{{ timeline_summary }}' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /create/i }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('report-templates', {
        json: {
          name: 'Weekly report',
          description: 'Weekly rollup',
          content_md: '# {{ title }}\n{{ timeline_summary }}',
        },
      }),
    )
    // The list is refetched so the new template shows without a manual reload.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'report-templates'],
      }),
    )
  })

  it('edits a template, PATCHing report-templates/{id} with the edited body', async () => {
    renderPanel()
    await screen.findByText('Incident summary')

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    const dialog = await screen.findByRole('dialog')
    // Form seeds from the existing template; change the description.
    fireEvent.change(within(dialog).getByLabelText(/description/i), {
      target: { value: 'Revised write-up' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('report-templates/t-1', {
        json: {
          name: 'Incident summary',
          description: 'Revised write-up',
          content_md: '# {{ title }}',
        },
      }),
    )
  })

  it('deletes a template after confirming and invalidates the list', async () => {
    const { invalidateSpy } = renderPanel()
    await screen.findByText('Incident summary')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    // Confirm dialog appears; confirm it. The confirm button carries a distinct
    // label so it doesn't collide with the row's "Delete" trigger.
    const confirm = await screen.findByRole('button', { name: 'Delete template' })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('report-templates/t-1'),
    )
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['settings', 'report-templates'],
      }),
    )
  })
})
