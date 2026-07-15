export type SettingsSection =
  | 'My account'
  | 'Security'
  | 'Organisation'
  | 'Users'
  | 'Roles'
  | 'Custom fields'
  | 'Case statuses'
  | 'Observable types'
  | 'Taxonomies & tags'
  | 'ATT&CK catalog'
  | 'Notifications'
  | 'SLA policies'
  | 'API keys'
  | 'Integrations'
  | 'Report templates'
  | 'Identity providers'
  | 'MFA policy'

export type Role = 'admin' | 'analyst' | 'readonly'

// The settings surface is split across three pages (see routes/_app/{settings,
// account,admin}.tsx). Each page renders its own vertical tab list via the shared
// SectionLayout.

/** Settings (`/settings`) — app/org configuration. Identical across OSS/enterprise. */
export const appSettingsSections: SettingsSection[] = [
  'Organisation',
  'Custom fields',
  'Case statuses',
  'Observable types',
  'Taxonomies & tags',
  'ATT&CK catalog',
  'Notifications',
  'SLA policies',
  'API keys',
  'Integrations',
  'Report templates',
]

/** Account (`/account`) — the signed-in user's personal settings. */
export const accountSections: SettingsSection[] = ['My account', 'Security']

/** Admin (`/admin`) — privileged platform/org administration. */
export const adminSections: SettingsSection[] = [
  'Users',
  'Roles',
  'Identity providers',
  'MFA policy',
]

// Every section across the three pages, used to resolve `?section` slugs back to
// a section regardless of which page owns it.
export const allSettingsSections: SettingsSection[] = [
  ...accountSections,
  ...appSettingsSections,
  ...adminSections,
]

// URL-friendly slugs so the active tab can live in the route param.
// e.g. 'API keys' -> 'api-keys', 'Identity providers' -> 'identity-providers'.
export function sectionToSlug(section: SettingsSection): string {
  return section.toLowerCase().replace(/&/g, '').trim().replace(/\s+/g, '-')
}

const slugToSectionMap = new Map<string, SettingsSection>(
  allSettingsSections.map((section) => [sectionToSlug(section), section]),
)

export function slugToSection(slug: string): SettingsSection | undefined {
  return slugToSectionMap.get(slug)
}

// The permission catalog (rows/columns of the Roles matrix) now comes from the
// backend via `permissionCatalogQueryOptions`, so the frontend and backend can't
// drift. The old hand-written `resources`/`verbs` arrays lived here.
