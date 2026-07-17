/**
 * @vitest-environment jsdom
 *
 * Component test for the MFA management section of the Security panel. Covers the
 * capabilities gate (hidden unless the platform enables MFA), the TOTP
 * enroll → confirm → recovery-codes → enabled/disable flow, and passkey
 * registration (driving navigator.credentials.create) + listing + deletion.
 *
 * Mocks the api client (get/post/delete), the notifications module, and
 * navigator.credentials.create. The webauthn encode/decode helpers run for real
 * so the register ceremony is exercised end to end.
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
import { MfaSection } from '#/components/pages/settings/panels/MfaSection'
import { api } from '#/lib/api/client'
import { bytesToBase64url } from '#/lib/auth/webauthn'
import type { PasskeyPublic } from '#/lib/auth/mfa'
import type { SystemCapabilities } from '#/lib/system/capabilities'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  API_BASE: '/api/v1',
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const postMock = vi.mocked(api.post)
const deleteMock = vi.mocked(api.delete)

const okJson = <T,>(body: T) => ({ json: () => Promise.resolve(body) }) as never
const rejectJson = (err: unknown) =>
  ({ json: () => Promise.reject(err) }) as never

// A fake attestation credential shaped like navigator.credentials.create's result.
const RAW_ID = new Uint8Array([1, 2, 3, 4])
const ATTESTATION_OBJECT = new Uint8Array([11, 22, 33])
const CLIENT_DATA = new Uint8Array([44, 55])
function fakeCredential() {
  return {
    id: 'new-passkey-id',
    rawId: RAW_ID.buffer,
    type: 'public-key',
    response: {
      attestationObject: ATTESTATION_OBJECT.buffer,
      clientDataJSON: CLIENT_DATA.buffer,
      getTransports: () => ['internal'],
    },
  } as unknown as Credential
}

const CREATION_OPTIONS = {
  challenge: bytesToBase64url(new Uint8Array([9, 9, 9]).buffer),
  rp: { id: 'example.com', name: 'Catlico' },
  user: {
    id: bytesToBase64url(new Uint8Array([7, 7]).buffer),
    name: 'admin@example.com',
    displayName: 'Admin',
  },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
}

const EXISTING_PASSKEYS: PasskeyPublic[] = [
  {
    id: 'pk-1',
    name: 'YubiKey 5C',
    transports: ['usb'],
    created_at: '2026-07-01T00:00:00Z',
  },
]

const RECOVERY_CODES = Array.from(
  { length: 10 },
  (_v, i) => `CODE-${String(i).padStart(4, '0')}`,
)

let createMock: ReturnType<typeof vi.fn>

function setCapabilities(caps: Partial<SystemCapabilities>) {
  getMock.mockImplementation((path) => {
    if (path === 'system/capabilities')
      return okJson({ sso: false, mfa: false, ...caps })
    if (path === 'auth/mfa/passkeys') return okJson(EXISTING_PASSKEYS)
    return okJson(null)
  })
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ModalsProvider>
          <MfaSection />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({} as never)
  setCapabilities({ mfa: true })
  createMock = vi.fn().mockResolvedValue(fakeCredential())
  Object.defineProperty(navigator, 'credentials', {
    value: { create: createMock },
    configurable: true,
  })
})

afterEach(() => cleanup())

describe('MfaSection capabilities gate', () => {
  it('renders nothing MFA-related when capabilities.mfa is false', async () => {
    setCapabilities({ mfa: false })
    renderSection()
    // Give the capabilities query a tick to resolve.
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('system/capabilities'),
    )
    expect(screen.queryByText(/authenticator app/i)).toBeNull()
    expect(screen.queryByText(/passkey/i)).toBeNull()
    // Passkeys must not be fetched when MFA is off.
    expect(getMock).not.toHaveBeenCalledWith('auth/mfa/passkeys')
  })

  it('shows the TOTP and Passkeys controls when capabilities.mfa is true', async () => {
    renderSection()
    await screen.findByRole('button', { name: /set up authenticator app/i })
    expect(screen.getByRole('heading', { name: /passkeys/i })).toBeTruthy()
  })
})

describe('MfaSection TOTP', () => {
  it('shows the secret and provisioning URI after enrolling', async () => {
    postMock.mockImplementation((path) => {
      if (path === 'auth/mfa/totp/enroll')
        return okJson({
          secret: 'JBSWY3DPEHPK3PXP',
          provisioning_uri: 'otpauth://totp/Catlico:admin?secret=JBSWY3DPEHPK3PXP',
        })
      return okJson(null)
    })
    renderSection()
    fireEvent.click(
      await screen.findByRole('button', { name: /set up authenticator app/i }),
    )
    await screen.findByText('JBSWY3DPEHPK3PXP')
    expect(
      screen.getByText(/otpauth:\/\/totp\/Catlico/i),
    ).toBeTruthy()
  })

  it('reveals the 10 recovery codes once after confirming a code, then enables', async () => {
    postMock.mockImplementation((path) => {
      if (path === 'auth/mfa/totp/enroll')
        return okJson({ secret: 'S3CR3T', provisioning_uri: 'otpauth://x' })
      if (path === 'auth/mfa/totp/confirm')
        return okJson({ recovery_codes: RECOVERY_CODES })
      return okJson(null)
    })
    renderSection()
    fireEvent.click(
      await screen.findByRole('button', { name: /set up authenticator app/i }),
    )
    const codeInput = await screen.findByLabelText(/verification code/i)
    fireEvent.change(codeInput, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify and enable/i }))

    // All 10 codes render exactly once.
    await screen.findByText('CODE-0000')
    const codes = screen.getAllByTestId('recovery-code')
    expect(codes).toHaveLength(10)
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('auth/mfa/totp/confirm', {
        json: { code: '123456' },
      }),
    )

    // Acknowledging hides the codes and shows the enabled status.
    fireEvent.click(screen.getByRole('button', { name: /saved these/i }))
    await screen.findByText(/authenticator app enabled/i)
    expect(screen.queryByTestId('recovery-code')).toBeNull()
  })

  it('treats a 409 on enroll as already set up and shows the enabled state', async () => {
    postMock.mockImplementation((path) => {
      if (path === 'auth/mfa/totp/enroll')
        return rejectJson({ response: { status: 409 } })
      return okJson(null)
    })
    renderSection()
    fireEvent.click(
      await screen.findByRole('button', { name: /set up authenticator app/i }),
    )
    await screen.findByText(/authenticator app enabled/i)
    expect(
      screen.getByRole('button', { name: /disable/i }),
    ).toBeTruthy()
  })

  it('disables TOTP with a password and a current code', async () => {
    let disableBody: unknown
    postMock.mockImplementation((path, opts) => {
      if (path === 'auth/mfa/totp/enroll')
        return rejectJson({ response: { status: 409 } })
      if (path === 'auth/mfa/totp/disable') {
        disableBody = opts?.json
        return okJson(undefined)
      }
      return okJson(null)
    })
    renderSection()
    // Reach the enabled state via the 409 shortcut.
    fireEvent.click(
      await screen.findByRole('button', { name: /set up authenticator app/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: /disable/i }))

    fireEvent.change(await screen.findByLabelText(/^password$/i), {
      target: { value: 'changeme' },
    })
    fireEvent.change(screen.getByLabelText(/current code/i), {
      target: { value: '654321' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /disable authenticator app/i }),
    )

    await waitFor(() =>
      expect(disableBody).toEqual({ password: 'changeme', code: '654321' }),
    )
    // Back to the not-enabled state: the setup button returns.
    await screen.findByRole('button', { name: /set up authenticator app/i })
  })
})

describe('MfaSection passkeys', () => {
  it('lists existing passkeys with a delete affordance', async () => {
    renderSection()
    await screen.findByText('YubiKey 5C')
    const row = screen.getByTestId('passkey-row-pk-1')
    expect(within(row).getByRole('button', { name: /delete/i })).toBeTruthy()
  })

  it('registers a passkey via navigator.credentials.create and posts the serialized attestation', async () => {
    let verifyBody: { credential?: unknown; name?: string } | undefined
    // First render lists the one existing passkey; after register we return two.
    let passkeyList = EXISTING_PASSKEYS
    getMock.mockImplementation((path) => {
      if (path === 'system/capabilities')
        return okJson({ sso: false, mfa: true })
      if (path === 'auth/mfa/passkeys') return okJson(passkeyList)
      return okJson(null)
    })
    postMock.mockImplementation((path, opts) => {
      if (path === 'auth/mfa/passkey/register/options')
        return okJson(CREATION_OPTIONS)
      if (path === 'auth/mfa/passkey/register/verify') {
        verifyBody = opts?.json as { credential?: unknown; name?: string }
        passkeyList = [
          ...EXISTING_PASSKEYS,
          {
            id: 'new-passkey-id',
            name: 'Laptop',
            transports: ['internal'],
            created_at: '2026-07-15T00:00:00Z',
          },
        ]
        return okJson(passkeyList[1])
      }
      return okJson(null)
    })

    renderSection()
    await screen.findByText('YubiKey 5C')

    fireEvent.change(screen.getByLabelText(/passkey name/i), {
      target: { value: 'Laptop' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }))

    // The browser ceremony ran with DECODED options (challenge as a buffer).
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    const passedOptions = createMock.mock.calls[0][0].publicKey
    expect(passedOptions.challenge).toBeInstanceOf(Uint8Array)
    expect(passedOptions.user.id).toBeInstanceOf(Uint8Array)

    // The verify POST carried the serialized attestation + the name.
    await waitFor(() => expect(verifyBody).toBeDefined())
    expect(verifyBody!.name).toBe('Laptop')
    expect(verifyBody!.credential).toEqual({
      id: 'new-passkey-id',
      rawId: bytesToBase64url(RAW_ID.buffer),
      type: 'public-key',
      response: {
        attestationObject: bytesToBase64url(ATTESTATION_OBJECT.buffer),
        clientDataJSON: bytesToBase64url(CLIENT_DATA.buffer),
        transports: ['internal'],
      },
    })

    // The new passkey shows up in the refreshed list.
    await screen.findByText('Laptop')
  })

  it('stays quiet when the passkey prompt is cancelled', async () => {
    createMock.mockRejectedValue(new Error('user cancelled'))
    postMock.mockImplementation((path) => {
      if (path === 'auth/mfa/passkey/register/options')
        return okJson(CREATION_OPTIONS)
      return okJson(null)
    })
    renderSection()
    await screen.findByText('YubiKey 5C')
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    // No verify POST is attempted after a cancellation.
    await waitFor(() =>
      expect(postMock).not.toHaveBeenCalledWith(
        'auth/mfa/passkey/register/verify',
        expect.anything(),
      ),
    )
  })

  it('deletes a passkey via DELETE after confirming', async () => {
    renderSection()
    await screen.findByText('YubiKey 5C')
    const row = screen.getByTestId('passkey-row-pk-1')
    fireEvent.click(within(row).getByRole('button', { name: /delete/i }))

    const confirm = await screen.findByRole('button', {
      name: /remove passkey/i,
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith('auth/mfa/passkeys/pk-1'),
    )
  })
})
