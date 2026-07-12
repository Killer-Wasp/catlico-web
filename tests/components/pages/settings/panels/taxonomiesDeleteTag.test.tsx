import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { api } from '#/lib/api/client'
import { TaxonomiesPanel } from '#/components/pages/settings/panels/TaxonomiesPanel'

type JsonResponse = { json: () => Promise<unknown> }

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), delete: vi.fn(), post: vi.fn() },
}))

let isSuperadmin = false
vi.mock('#/lib/auth/usePermissions', () => ({
  usePermissions: () => ({
    can: () => isSuperadmin,
    isSuperadmin,
    groups: [],
    isLoaded: true,
    isLoading: false,
  }),
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
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

const freetag = {
  id: 5,
  tag: 'phishing',
  namespace: null,
  predicate: null,
  value: null,
  colour: null,
  organisation_id: 'origin-soc',
}

beforeEach(() => {
  localStorage.setItem('catlico.orgId', 'origin-soc')
  isSuperadmin = false
  vi.mocked(api.get).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => [freetag],
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ ...freetag, id: 9, tag: 'malware' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
})

afterEach(cleanup)

function Harness({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ModalsProvider>
          <Notifications />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('TaxonomiesPanel freetag delete', () => {
  test('non-superadmins see no delete control on freetags', async () => {
    render(
      <Harness>
        <TaxonomiesPanel />
      </Harness>,
    )
    await screen.findByText('phishing')
    expect(
      screen.queryByRole('button', { name: /delete tag phishing/i }),
    ).toBeNull()
  })

  test('superadmins can delete a freetag through a confirm dialog', async () => {
    isSuperadmin = true
    render(
      <Harness>
        <TaxonomiesPanel />
      </Harness>,
    )
    await screen.findByText('phishing')

    fireEvent.click(
      screen.getByRole('button', { name: /delete tag phishing/i }),
    )

    const dialog = await screen.findByRole('dialog')
    const confirmButton = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )
    expect(confirmButton).toBeDefined()
    fireEvent.click(confirmButton as HTMLButtonElement)

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('tags/5'),
    )
  })
})

describe('TaxonomiesPanel freetag add', () => {
  test('non-superadmins do not see the + add button', async () => {
    render(
      <Harness>
        <TaxonomiesPanel />
      </Harness>,
    )
    await screen.findByText('phishing')
    expect(screen.queryByRole('button', { name: /\+ add/i })).toBeNull()
  })

  test('superadmin adds a freetag via the modal', async () => {
    isSuperadmin = true
    render(
      <Harness>
        <TaxonomiesPanel />
      </Harness>,
    )
    await screen.findByText('phishing')

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    const input = await screen.findByLabelText('Tag name')
    fireEvent.change(input, { target: { value: 'malware' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('tags/', {
        json: { predicate: 'malware', namespace: '', value: '' },
      }),
    )
  })

  test('a name with ":" is rejected inline and not sent', async () => {
    isSuperadmin = true
    render(
      <Harness>
        <TaxonomiesPanel />
      </Harness>,
    )
    await screen.findByText('phishing')

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    const input = await screen.findByLabelText('Tag name')
    fireEvent.change(input, { target: { value: 'tlp:red' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(await screen.findByText(/can’t contain/i)).toBeDefined()
    expect(api.post).not.toHaveBeenCalled()
  })
})
