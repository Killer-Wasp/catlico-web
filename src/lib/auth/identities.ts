/**
 * Linked external SSO identities for the signed-in account: the federated
 * subjects (Okta, Entra, Google, …) that can sign this user in. All routes are
 * authed and only exist on builds where the platform has SSO enabled
 * (`/system/capabilities`), so the Security panel gates this whole surface on
 * that flag before calling anything — mirroring how MFA is gated in
 * `#/lib/auth/mfa`.
 *
 * Unlinking the user's ONLY sign-in method is refused server-side with a 409
 * ("Cannot unlink your only sign-in method"); the caller surfaces that detail
 * and keeps the row rather than treating it as a generic failure.
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

export type LinkedIdentity = {
  id: string
  provider_id: string
  provider_name: string
  subject: string
  created_at: string
}

export const identitiesKeys = {
  all: ['identities'] as const,
  list: () => [...identitiesKeys.all, 'list'] as const,
}

export async function fetchIdentities(): Promise<LinkedIdentity[]> {
  return api.get('auth/identities').json<LinkedIdentity[]>()
}

export const identitiesQueryOptions = (enabled = true) =>
  queryOptions({
    queryKey: identitiesKeys.list(),
    queryFn: fetchIdentities,
    enabled,
    retry: false,
  })

/**
 * Unlink an external identity by id (204). 404 if it isn't yours; 409 if it is
 * the account's only remaining sign-in method — the caller reads the 409 detail
 * and keeps the row.
 */
export async function unlinkIdentity(id: string): Promise<void> {
  await api.delete(`auth/identities/${id}`)
}
