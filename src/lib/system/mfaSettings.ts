/**
 * Org-wide multi-factor-auth policy, managed by a platform superadmin under
 * `/admin/mfa/settings`. This is the admin-side counterpart to the per-account
 * MFA enrolment in `#/lib/auth/mfa`: it decides whether members must set up MFA
 * (`enabled`) and whether that requirement is enforced for everyone
 * (`enforced`). Every route is superadmin-gated on the backend (403 otherwise)
 * and only exists on builds that report the `mfa` capability.
 *
 * CRITICAL: the PUT is a FULL REPLACE — it overwrites BOTH fields on every
 * call. `updateMfaSettings` therefore takes the complete `{enabled, enforced}`
 * pair (the type makes both mandatory) so a caller can never silently clobber
 * the field it didn't mean to touch by sending a partial body.
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

export type MfaSettings = {
  enabled: boolean
  enforced: boolean
}

export const mfaSettingsKeys = {
  all: ['admin', 'mfa-settings'] as const,
}

export async function fetchMfaSettings(): Promise<MfaSettings> {
  return api.get('admin/mfa/settings').json<MfaSettings>()
}

/**
 * Upsert the singleton policy. Sends the FULL `{enabled, enforced}` pair — the
 * backend replaces both fields and refreshes its live cache. Returns the stored
 * settings so the caller can reflect the server's canonical state.
 */
export async function updateMfaSettings(
  settings: MfaSettings,
): Promise<MfaSettings> {
  return api
    .put('admin/mfa/settings', { json: settings })
    .json<MfaSettings>()
}

export const mfaSettingsQueryOptions = () =>
  queryOptions({
    queryKey: mfaSettingsKeys.all,
    queryFn: fetchMfaSettings,
    retry: false,
  })
