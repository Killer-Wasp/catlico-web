import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

/**
 * The platform's feature flags, from `GET /system/capabilities`. Enterprise
 * builds enable extras (SSO, MFA) that the OSS build omits; the web app reads
 * these to decide which optional UI to show at all. Unknown keys pass through so
 * new flags don't need a type change here.
 */
export type SystemCapabilities = {
  sso: boolean
  mfa: boolean
  // Custom saved-views "Dashboards" feature. Enterprise-only: false on the OSS
  // build, which gates the /dashboards route + nav (Overview at / stays).
  dashboard: boolean
} & Record<string, unknown>

/** Authenticated GET — read once per visit and cached (config, not data). */
export async function fetchSystemCapabilities(): Promise<SystemCapabilities> {
  return api.get('system/capabilities').json<SystemCapabilities>()
}

export const systemCapabilitiesQueryOptions = () =>
  queryOptions({
    queryKey: ['system', 'capabilities'] as const,
    queryFn: fetchSystemCapabilities,
    // Server configuration; it won't change mid-visit. A failed probe must not
    // block the surrounding settings page — one attempt, then treat as "off".
    staleTime: Infinity,
    retry: false,
  })
