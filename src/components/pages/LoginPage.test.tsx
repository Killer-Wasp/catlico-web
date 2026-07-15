/**
 * @vitest-environment jsdom
 *
 * Component test for the login page's SSO section. It fetches enterprise
 * identity providers from `GET /auth/providers` (a pre-auth call) and, for each,
 * renders a "Continue with {name}" button that starts SSO via a FULL-PAGE
 * navigation (`window.location.assign`) to the provider's absolute authorize
 * URL. When the list is empty (the OSS default) or the fetch errors, no SSO UI
 * renders at all and the password form is untouched.
 *
 * Mocks the api client (get), the auth session `login` helper, and the router's
 * `useNavigate`/`Link` — matching SecurityPanel/AllUsersPanel test conventions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './LoginPage'
import { api } from '#/lib/api/client'
import { login } from '#/lib/auth/session'
import type { IdentityProvider } from '#/lib/auth/authProviders'

// API_BASE is absolute here, so the authorize URL resolves to the API origin
// (http://localhost:8000), NOT the web app's own origin.
vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_BASE: 'http://localhost:8000/api/v1',
}))

vi.mock('#/lib/auth/session', () => ({
  login: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}))

const getMock = vi.mocked(api.get)
const loginMock = vi.mocked(login)

const PROVIDERS: IdentityProvider[] = [
  {
    id: 'p-okta',
    name: 'Okta',
    kind: 'oidc',
    authorize_path: '/api/v1/auth/oidc/okta/authorize',
  },
  {
    id: 'p-adfs',
    name: 'Corp ADFS',
    kind: 'saml',
    authorize_path: '/api/v1/auth/saml/adfs/authorize',
  },
]

function mockProviders(value: IdentityProvider[]) {
  getMock.mockReturnValue({ json: () => Promise.resolve(value) } as never)
}

function mockProvidersError() {
  // Reject lazily inside json() so the rejection is owned by the query, not
  // dangling at mock-setup time.
  getMock.mockReturnValue({
    json: () => Promise.reject(new Error('boom')),
  } as never)
}

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <LoginPage />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

let assignSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  getMock.mockReset()
  loginMock.mockReset()
  assignSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:3000', assign: assignSpy },
  })
})

afterEach(() => cleanup())

describe('LoginPage SSO section', () => {
  it('renders a "Continue with" button per provider and full-page navigates to the absolute authorize URL on click', async () => {
    mockProviders(PROVIDERS)
    renderLogin()

    const okta = await screen.findByRole('button', {
      name: /continue with okta/i,
    })
    expect(
      screen.getByRole('button', { name: /continue with corp adfs/i }),
    ).toBeTruthy()

    fireEvent.click(okta)

    // Full-page navigation to the API origin + authorize_path — not a router
    // navigate, not the web app's own origin.
    expect(assignSpy).toHaveBeenCalledTimes(1)
    expect(assignSpy).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/oidc/okta/authorize',
    )
  })

  it('shows an "or" divider between the SSO buttons and the password form when providers exist', async () => {
    mockProviders(PROVIDERS)
    renderLogin()

    await screen.findByRole('button', { name: /continue with okta/i })
    expect(screen.getByText('or')).toBeTruthy()
    // Password form is still present and additive.
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy()
  })

  it('renders NO SSO buttons or divider when the provider list is empty (OSS default) and keeps the password form working', async () => {
    mockProviders([])
    renderLogin()

    // The password form renders immediately.
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy()
    // Give the (resolved-empty) query a tick; still no SSO UI.
    await Promise.resolve()

    expect(screen.queryByText('or')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /continue with/i }),
    ).toBeNull()

    // The password form submits via `login`.
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'changeme' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(loginMock).toHaveBeenCalledWith('admin@example.com', 'changeme')
    expect(assignSpy).not.toHaveBeenCalled()
  })

  it('does not break the login form when the providers fetch errors', async () => {
    mockProvidersError()
    renderLogin()

    // No SSO UI, and the password form is fully usable.
    const signIn = await screen.findByRole('button', { name: /^sign in$/i })
    expect(
      screen.queryByRole('button', { name: /continue with/i }),
    ).toBeNull()
    expect(screen.queryByText('or')).toBeNull()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pw' },
    })
    fireEvent.click(signIn)
    expect(loginMock).toHaveBeenCalledWith('a@b.com', 'pw')
  })
})
