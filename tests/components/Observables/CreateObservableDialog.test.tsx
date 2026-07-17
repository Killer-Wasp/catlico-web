// @vitest-environment jsdom
import { CreateObservableDialog } from '#/components/Observables/CreateObservableDialog'
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
} from '@testing-library/react'
import { HTTPError } from 'ky'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  API_BASE: '/api/v1',
}))

type JsonResponse = { json: () => Promise<unknown> }

const observableTypes = [
  { name: 'domain', is_attachment: false },
  { name: 'file', is_attachment: true },
]

const casePublic = {
  id: 42,
  status: 'Open',
  severity: 2,
  tlp: 2,
  pap: 2,
  title: 'Phishing wave',
  assignee_email: null,
  tags: [],
  tasks: [],
  created_at: '2026-06-12T09:21:00Z',
  updated_at: null,
  sla_due_at: null,
  sla_state: null,
  duplicate_of_case_id: null,
}

const casesPage = { items: [casePublic], total: 1, skip: 0, limit: 10 }

function http409(detail: string): HTTPError {
  const response = new Response(JSON.stringify({ detail }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
  return new HTTPError(
    response,
    new Request('http://localhost/api/v1/cases/42/observables'),
    {} as ConstructorParameters<typeof HTTPError>[2],
  )
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

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation((input) => {
    const url = String(input)
    if (url === 'observable-types/') {
      return {
        json: async () => observableTypes,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    if (url === 'cases/') {
      return {
        json: async () => casesPage,
      } satisfies JsonResponse as ReturnType<typeof api.get>
    }
    return {
      json: async () => ({ items: [], total: 0, skip: 0, limit: 10 }),
    } satisfies JsonResponse as ReturnType<typeof api.get>
  })
  vi.mocked(api.post).mockReturnValue({
    json: async () => ({ id: 'obs-new' }),
  } satisfies JsonResponse as ReturnType<typeof api.post>)
})

afterEach(cleanup)

function renderDialog(props: Partial<Parameters<typeof CreateObservableDialog>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <Notifications />
        <CreateObservableDialog
          opened
          onClose={() => {}}
          {...props}
        />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

// Mantine's Combobox dropdown keeps its Popover at `display:none` inside a
// Modal under jsdom (floating-ui can't position it), so options read as
// "hidden" to Testing Library even while present and clickable. Open the
// combobox, then match the option with `hidden: true`.
async function pickType(name: string) {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Type' }))
  fireEvent.click(
    await screen.findByRole('option', { name, hidden: true }),
  )
}

describe('CreateObservableDialog', () => {
  test('string-mode submit posts to the JSON observables endpoint', async () => {
    renderDialog({ caseId: 42 })

    await pickType('domain')
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
      target: { value: 'evil.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add observable' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('cases/42/observables', {
        json: expect.objectContaining({
          observable_type: 'domain',
          data: 'evil.example',
          tlp: 2,
          ioc: false,
          sighted: false,
        }),
      }),
    )
  })

  test('selecting an attachment type reveals the file field and posts multipart', async () => {
    renderDialog({ caseId: 42 })

    // String type first: value field present, no file field.
    await pickType('domain')
    expect(screen.getByRole('textbox', { name: 'Value' })).toBeDefined()

    // Switch to the attachment type: file field appears, value field gone.
    // The Modal renders in a portal on document.body, so query the document.
    await pickType('file')
    expect(screen.queryByRole('textbox', { name: 'Value' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeDefined()
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = new File(['data'], 'evidence.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Flip the flags so the String()-coercion in createCaseObservableFile
    // (the most bug-prone line) is exercised with non-default values.
    fireEvent.click(
      screen.getByRole('checkbox', { name: /IOC/i }),
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sighted' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add observable' }))

    await waitFor(() => {
      const call = vi
        .mocked(api.post)
        .mock.calls.find((c) => String(c[0]) === 'cases/42/observables/file')
      expect(call).toBeTruthy()
      const body = call?.[1]?.body as FormData
      expect(body).toBeInstanceOf(FormData)
      expect(body.get('observable_type')).toBe('file')
      expect(body.get('file')).toBeInstanceOf(File)
      // FormData values are strings: booleans/numbers must be String()-coerced.
      expect(body.get('tlp')).toBe('2')
      expect(body.get('ioc')).toBe('true')
      expect(body.get('sighted')).toBe('true')
    })
  })

  test('org-wide mode requires a case selection before enabling submit', async () => {
    renderDialog()

    await pickType('domain')
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
      target: { value: 'evil.example' },
    })

    // Without a chosen case the submit stays disabled.
    expect(
      screen.getByRole('button', { name: 'Add observable' }),
    ).toHaveProperty('disabled', true)

    // Open the case combobox and search for a case.
    fireEvent.click(
      await screen.findByRole('button', { name: /Case/i }),
    )
    fireEvent.change(
      await screen.findByPlaceholderText('Search cases by title'),
      { target: { value: 'Phishing' } },
    )

    // Pick a case from the search results. Mantine combobox options are hidden
    // inside a Modal popover under jsdom, so search with hidden: true.
    fireEvent.click(
      await screen.findByRole('option', { name: /Phishing wave/i, hidden: true }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add observable' }),
      ).toHaveProperty('disabled', false),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add observable' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        'cases/42/observables',
        expect.anything(),
      ),
    )
  })

  test('surfaces a friendly message when the observable is a 409 duplicate', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async (): Promise<unknown> => {
        throw http409('Observable with this type and value already exists')
      },
    } satisfies JsonResponse as ReturnType<typeof api.post>)

    renderDialog({ caseId: 42 })

    await pickType('domain')
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
      target: { value: 'evil.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add observable' }))

    expect(await screen.findByText(/already exists/i)).toBeDefined()
  })

  test('surfaces a generic message on a non-409 failure', async () => {
    vi.mocked(api.post).mockReturnValue({
      json: async (): Promise<unknown> => {
        throw new Error('network down')
      },
    } satisfies JsonResponse as ReturnType<typeof api.post>)

    renderDialog({ caseId: 42 })

    await pickType('domain')
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
      target: { value: 'evil.example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add observable' }))

    expect(
      await screen.findByText(/could not create the observable/i),
    ).toBeDefined()
  })
})
