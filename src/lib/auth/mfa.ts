/**
 * Multi-factor-auth management for the signed-in account: TOTP (authenticator
 * app) enrolment and passkey (WebAuthn) registration. All routes are authed and
 * only exist when the platform has MFA enabled (`/system/capabilities`), so the
 * Security panel gates this whole surface on that flag before calling anything.
 *
 * The passkey registration ceremony mirrors the sign-in side in
 * `#/lib/auth/session` (`verifyPasskey`): decode the server's base64url options,
 * drive `navigator.credentials.create`, then re-serialize for the verify POST.
 * A dismissed prompt surfaces as the shared `PasskeyCancelledError`.
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { PasskeyCancelledError } from '#/lib/auth/session'
import {
  decodeCreationOptions,
  serializeAttestation,
} from '#/lib/auth/webauthn'
import type { PublicKeyCreationOptionsJSON } from '#/lib/auth/webauthn'

export type TotpEnrollResult = {
  secret: string
  provisioning_uri: string
}

export type TotpConfirmResult = {
  recovery_codes: string[]
}

export type PasskeyPublic = {
  id: string
  name: string | null
  transports: string[]
  created_at: string
}

export const mfaKeys = {
  all: ['mfa'] as const,
  passkeys: () => [...mfaKeys.all, 'passkeys'] as const,
}

/**
 * Begin TOTP enrolment: returns the shared `secret` and an `otpauth://`
 * `provisioning_uri` for the authenticator app. 409s if TOTP is already
 * confirmed on the account (the caller reads that as "already set up").
 */
export async function enrollTotp(): Promise<TotpEnrollResult> {
  return api.post('auth/mfa/totp/enroll').json<TotpEnrollResult>()
}

/**
 * Confirm enrolment with a code from the app. On success the server returns the
 * 10 one-time recovery codes — shown to the user exactly once. 400s on a bad
 * code.
 */
export async function confirmTotp(code: string): Promise<TotpConfirmResult> {
  return api
    .post('auth/mfa/totp/confirm', { json: { code } })
    .json<TotpConfirmResult>()
}

/** Turn TOTP off. Requires the account password AND a current code (204). */
export async function disableTotp(
  password: string,
  code: string,
): Promise<void> {
  await api.post('auth/mfa/totp/disable', { json: { password, code } })
}

export async function fetchPasskeys(): Promise<PasskeyPublic[]> {
  return api.get('auth/mfa/passkeys').json<PasskeyPublic[]>()
}

export const passkeysQueryOptions = (enabled = true) =>
  queryOptions({
    queryKey: mfaKeys.passkeys(),
    queryFn: fetchPasskeys,
    enabled,
    retry: false,
  })

/**
 * Register a new passkey for this account: fetch creation options, prompt the
 * authenticator via `navigator.credentials.create`, then POST the serialized
 * attestation (with an optional friendly `name`). A dismissed or unavailable
 * prompt raises `PasskeyCancelledError` so the UI can stay quiet rather than
 * showing a scary error — matching the login-side handling.
 */
export async function registerPasskey(name?: string): Promise<PasskeyPublic> {
  const options = await api
    .post('auth/mfa/passkey/register/options')
    .json<PublicKeyCreationOptionsJSON>()

  // Decode OUTSIDE the try: malformed server options are a real bug and must
  // propagate as such, not be masked as a user cancellation.
  const publicKey = decodeCreationOptions(options)
  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({ publicKey })
  } catch {
    throw new PasskeyCancelledError('Passkey registration was cancelled.')
  }
  if (!credential) throw new PasskeyCancelledError()

  const trimmed = name?.trim()
  return api
    .post('auth/mfa/passkey/register/verify', {
      json: {
        credential: serializeAttestation(credential as PublicKeyCredential),
        ...(trimmed ? { name: trimmed } : {}),
      },
    })
    .json<PasskeyPublic>()
}

export async function deletePasskey(id: string): Promise<void> {
  await api.delete(`auth/mfa/passkeys/${id}`)
}
