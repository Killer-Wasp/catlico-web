import { queryOptions } from '@tanstack/react-query'
import { API_BASE, api } from '#/lib/api/client'

/**
 * A configured enterprise SSO identity provider, as returned by
 * `GET /auth/providers`. In OSS (or when no enterprise providers are
 * configured) the list is empty and the login page shows no SSO UI at all.
 *
 * `authorize_path` is an ABSOLUTE API path (e.g.
 * `/api/v1/auth/oidc/{slug}/authorize`). Starting SSO requires a FULL-PAGE
 * navigation to it (so the IdP redirect + state cookie round-trip works) — see
 * `authorizeUrl` for turning it into an absolute URL against the API origin.
 */
export type IdentityProvider = {
  id: string
  name: string
  kind: 'oidc' | 'saml'
  authorize_path: string
}

/** Pre-auth GET — the login page calls it before any session exists. */
export async function fetchAuthProviders(): Promise<IdentityProvider[]> {
  return api.get('auth/providers').json<IdentityProvider[]>()
}

export const authProvidersQueryOptions = () =>
  queryOptions({
    queryKey: ['auth', 'providers'] as const,
    queryFn: fetchAuthProviders,
    // The set of providers is server-configuration; it won't change mid-visit.
    staleTime: Infinity,
    // A failed pre-auth probe must never block the password form — one attempt,
    // then fall back to no SSO section.
    retry: false,
  })

/**
 * Resolve a provider's absolute `authorize_path` into the full URL the browser
 * must navigate to. The path already carries the `/api/v1` prefix, so we only
 * need the API ORIGIN: derive it from `API_BASE` (which may be an absolute URL
 * like `http://localhost:8000/api/v1` or a same-origin relative `/api/v1`) and
 * resolve the absolute path against it.
 */
export function authorizeUrl(authorizePath: string): string {
  const apiOrigin = new URL(API_BASE, window.location.origin).origin
  return new URL(authorizePath, apiOrigin).toString()
}
