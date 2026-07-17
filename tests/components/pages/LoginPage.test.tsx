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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { LoginPage } from '#/components/pages/LoginPage'
import { api } from '#/lib/api/client'
import {
  confirmMfaEnrollment,
  login,
  mfaPendingKind,
  startMfaEnrollment,
  verifyMfaCode,
  verifyPasskey,
  PasskeyCancelledError,
} from '#/lib/auth/session'
import type { IdentityProvider } from '#/lib/auth/authProviders'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

// API_BASE is absolute here, so the authorize URL resolves to the API origin
// (http://localhost:8000), NOT the web app's own origin.
vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_BASE: 'http://localhost:8000/api/v1',
}))

vi.mock('#/lib/auth/session', () => ({
  login: vi.fn(),
  verifyMfaCode: vi.fn(),
  verifyPasskey: vi.fn(),
  startMfaEnrollment: vi.fn(),
  confirmMfaEnrollment: vi.fn(),
  mfaPendingKind: vi.fn(),
  PasskeyCancelledError: class extends Error {},
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, ...rest }: { children: React.ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}))

const getMock = vi.mocked(api.get)
const loginMock = vi.mocked(login)
const verifyMfaCodeMock = vi.mocked(verifyMfaCode)
const verifyPasskeyMock = vi.mocked(verifyPasskey)
const startMfaEnrollmentMock = vi.mocked(startMfaEnrollment)
const confirmMfaEnrollmentMock = vi.mocked(confirmMfaEnrollment)
const mfaPendingKindMock = vi.mocked(mfaPendingKind)

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
  verifyMfaCodeMock.mockReset()
  verifyPasskeyMock.mockReset()
  startMfaEnrollmentMock.mockReset()
  confirmMfaEnrollmentMock.mockReset()
  mfaPendingKindMock.mockReset()
  // Default: pending tokens route to the ordinary verify step. Enrollment tests
  // opt in explicitly by returning 'mfa_enrollment'.
  mfaPendingKindMock.mockReturnValue('mfa_pending')
  navigateMock.mockReset()
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

describe('LoginPage MFA step', () => {
  // Drive the password form to the point where the API demands a second factor.
  async function reachMfaStep(pendingToken = 'pending-xyz') {
    mockProviders([])
    loginMock.mockResolvedValue({ status: 'mfa_required', pendingToken })
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'changeme' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    return screen.findByLabelText(/authentication code/i)
  }

  it('shows the code step (not logged in yet) when login returns mfa_required', async () => {
    await reachMfaStep()

    // Second-factor UI is up; we have NOT navigated (not logged in).
    expect(screen.getByRole('button', { name: /use a passkey/i })).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(verifyMfaCodeMock).not.toHaveBeenCalled()
    // The password fields are gone — we're on the second step.
    expect(screen.queryByLabelText(/^email$/i)).toBeNull()
  })

  it('verifies a valid code (with the pending token) and completes login', async () => {
    const codeInput = await reachMfaStep('pending-xyz')
    verifyMfaCodeMock.mockResolvedValue(undefined)

    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    await waitFor(() =>
      expect(verifyMfaCodeMock).toHaveBeenCalledWith('pending-xyz', '123456'),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalled())
  })

  it('shows an inline error and stays on the step when the code is rejected (401)', async () => {
    const codeInput = await reachMfaStep()
    verifyMfaCodeMock.mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 401 }),
        new Request('http://x/api/v1/auth/mfa/verify'),
        {} as never,
      ),
    )

    fireEvent.change(codeInput, { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))

    expect(await screen.findByText(/invalid.*code/i)).toBeTruthy()
    // Still on the code step; no navigation.
    expect(screen.getByLabelText(/authentication code/i)).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('runs the passkey flow (verifyPasskey with the pending token) and completes login', async () => {
    await reachMfaStep('pending-pk')
    verifyPasskeyMock.mockResolvedValue(undefined)

    fireEvent.click(screen.getByRole('button', { name: /use a passkey/i }))

    await waitFor(() =>
      expect(verifyPasskeyMock).toHaveBeenCalledWith('pending-pk'),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalled())
  })

  it('stays on the step with a gentle message when the passkey prompt is cancelled', async () => {
    await reachMfaStep()
    verifyPasskeyMock.mockRejectedValue(new PasskeyCancelledError('cancelled'))

    fireEvent.click(screen.getByRole('button', { name: /use a passkey/i }))

    expect(await screen.findByText(/passkey.*cancel/i)).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/authentication code/i)).toBeTruthy()
  })

  it('returns to the password form via the back/cancel control', async () => {
    await reachMfaStep()

    fireEvent.click(screen.getByRole('button', { name: /back|cancel/i }))

    // Password form is back; the code step is gone.
    expect(await screen.findByLabelText(/^email$/i)).toBeTruthy()
    expect(screen.queryByLabelText(/authentication code/i)).toBeNull()
  })

  it('routes an mfa_pending token to the verify step, not enrollment (regression guard)', async () => {
    await reachMfaStep()

    // The verify UI is up; the forced-enrollment surface never appears.
    expect(screen.getByRole('button', { name: /use a passkey/i })).toBeTruthy()
    expect(screen.queryByTestId('enroll-secret')).toBeNull()
    expect(startMfaEnrollmentMock).not.toHaveBeenCalled()
  })
})

describe('LoginPage forced-enrollment step', () => {
  // Drive the password form to the point where the API forces MFA enrolment.
  async function reachEnrollStep(
    pendingToken = 'pending-enroll',
    enroll = { secret: 'S3CR3T', provisioning_uri: 'otpauth://totp/x' },
  ) {
    mockProviders([])
    loginMock.mockResolvedValue({ status: 'mfa_required', pendingToken })
    mfaPendingKindMock.mockReturnValue('mfa_enrollment')
    startMfaEnrollmentMock.mockResolvedValue(enroll)
    renderLogin()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'changeme' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    return screen.findByTestId('enroll-secret')
  }

  it('renders the enrollment step (secret shown), NOT the verify step, on an mfa_enrollment token', async () => {
    const secret = await reachEnrollStep('pending-enroll')

    expect(secret.textContent).toContain('S3CR3T')
    expect(screen.getByTestId('enroll-uri').textContent).toContain(
      'otpauth://totp/x',
    )
    expect(startMfaEnrollmentMock).toHaveBeenCalledWith('pending-enroll')
    // This is enrollment, not verify: no passkey option, not logged in yet.
    expect(
      screen.queryByRole('button', { name: /use a passkey/i }),
    ).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/^email$/i)).toBeNull()
  })

  it('confirms a valid code, shows the recovery codes once, then acknowledges and navigates', async () => {
    await reachEnrollStep('pending-enroll')
    confirmMfaEnrollmentMock.mockResolvedValue({
      recoveryCodes: ['aaa-111', 'bbb-222', 'ccc-333'],
    })

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }))

    await waitFor(() =>
      expect(confirmMfaEnrollmentMock).toHaveBeenCalledWith(
        'pending-enroll',
        '123456',
      ),
    )

    // Recovery codes are shown once; no navigation until the user acknowledges.
    const codes = await screen.findAllByTestId('recovery-code')
    expect(codes.map((c) => c.textContent)).toEqual([
      'aaa-111',
      'bbb-222',
      'ccc-333',
    ])
    expect(navigateMock).not.toHaveBeenCalled()

    // Acknowledge → session already completed at confirm time → navigate, and
    // the codes are gone from the DOM (cleared from transient state).
    fireEvent.click(
      screen.getByRole('button', { name: /saved these|continue/i }),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalled())
    expect(screen.queryByTestId('recovery-code')).toBeNull()
  })

  it('surfaces an inline error and stays on the enrollment step when the code is rejected (400), with no session completed', async () => {
    await reachEnrollStep('pending-enroll')
    confirmMfaEnrollmentMock.mockRejectedValue(
      new HTTPError(
        new Response(null, { status: 400 }),
        new Request('http://x/api/v1/auth/mfa/enrollment/confirm'),
        {} as never,
      ),
    )

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }))

    expect(await screen.findByText(/invalid.*code/i)).toBeTruthy()
    // Still on the enrollment step; no recovery codes, no navigation.
    expect(screen.getByTestId('enroll-secret')).toBeTruthy()
    expect(screen.queryByTestId('recovery-code')).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
