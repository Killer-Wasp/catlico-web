// @vitest-environment jsdom
import { CaseTemplatesPage } from '#/components/pages/CaseTemplatesPage'
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

const routerState = vi.hoisted(() => ({
  pathname: '/case-templates',
}))

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const resolveHref = (to: string, params?: Record<string, string>) =>
  params ? to.replace('$templateId', params.templateId) : to

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Outlet: () => <div>Template editor outlet</div>,
  useLocation: () => ({ pathname: routerState.pathname }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children?: React.ReactNode
  }) => (
    <a href={resolveHref(to, params)} {...props}>
      {children}
    </a>
  ),
  // ButtonLink is built with createLink; the mock resolves the href and renders
  // the wrapped component (a Mantine Button rendered as an anchor).
  createLink:
    (Component: React.ComponentType<Record<string, unknown>>) =>
    ({
      to,
      params,
      children,
      ...props
    }: {
      to: string
      params?: Record<string, string>
      children?: React.ReactNode
    }) => (
      <Component href={resolveHref(to, params)} {...props}>
        {children}
      </Component>
    ),
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
  summary: null,
  organisation_id: 'org-1',
  tasks: [
    {
      id: 'task-template-1',
      title: 'Triage',
      group: 'Triage',
      description: 'Confirm scope.',
      order: 0,
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

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <CaseTemplatesPage />
      </MantineProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.delete).mockReset()
  vi.mocked(api.get).mockReturnValue({
    json: async () => ({
      items: [templateDto],
      total: 1,
      skip: 0,
      limit: 100,
    }),
  } satisfies JsonResponse as ReturnType<typeof api.get>)
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({
      ...templateDto,
      id: 8,
      name: 'phishing-playbook-copy',
    }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
  vi.mocked(api.put).mockReturnValue({
    json: async () => templateDto.tags,
  } satisfies JsonResponse as ReturnType<typeof api.put>)
  vi.mocked(api.delete).mockReturnValue({} as ReturnType<typeof api.delete>)
})

afterEach(cleanup)

describe('CaseTemplatesPage', () => {
  afterEach(() => {
    routerState.pathname = '/case-templates'
  })

  test('loads backend templates and links rows to the item editor route', async () => {
    render(<Harness />)

    expect(
      await screen.findByText('Phishing / credential harvesting'),
    ).toBeDefined()
    expect(api.get).toHaveBeenCalledWith('case-templates/', {
      searchParams: { limit: '100', skip: '0' },
    })
    expect(
      screen
        .getByRole('link', { name: 'Phishing / credential harvesting' })
        .getAttribute('href'),
    ).toBe('/case-templates/7')
    expect(screen.getByText('phishing')).toBeDefined()
    expect(screen.getByText('T1566')).toBeDefined()
  })

  test('renders templates as compact table rows with menu actions', async () => {
    render(<Harness />)

    const table = await screen.findByRole('table', {
      name: 'Case templates',
    })
    const row = within(table).getByRole('row', {
      name: /Phishing \/ credential harvesting/i,
    })

    expect(
      within(row)
        .getByRole('link', {
          name: 'Phishing / credential harvesting',
        })
        .getAttribute('href'),
    ).toBe('/case-templates/7')
    expect(within(row).getByText('phishing')).toBeDefined()
    expect(within(row).getByText('T1566')).toBeDefined()
    expect(screen.queryByText('Standard phishing playbook.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull()

    fireEvent.click(
      within(row).getByRole('button', {
        name: 'Template actions for Phishing / credential harvesting',
      }),
    )

    expect(
      await screen.findByRole('menuitem', { name: 'Duplicate' }),
    ).toBeDefined()
  })

  test('duplicates templates through the row action menu', async () => {
    render(<Harness />)

    expect(
      await screen.findByText('Phishing / credential harvesting'),
    ).toBeDefined()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Template actions for Phishing / credential harvesting',
      }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        'case-templates/',
        expect.objectContaining({
          json: expect.objectContaining({
            display_name: 'Phishing / credential harvesting (copy)',
          }),
        }),
      ),
    )
  })

  test('deletes templates through the row action menu', async () => {
    render(<Harness />)

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Template actions for Phishing / credential harvesting',
      }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('case-templates/7'),
    )
  })

  test('renders the child editor outlet on template item routes', () => {
    routerState.pathname = '/case-templates/7'

    render(<Harness />)

    expect(screen.getByText('Template editor outlet')).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Case templates' })).toBeNull()
  })
})
