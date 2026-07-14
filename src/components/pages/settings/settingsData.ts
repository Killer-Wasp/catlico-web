export type SettingsSection =
  | 'My account'
  | 'Security'
  | 'Organisation'
  | 'Users & roles'
  | 'Profiles & permissions'
  | 'Custom fields'
  | 'Observable types'
  | 'Taxonomies & tags'
  | 'ATT&CK catalog'
  | 'Notifications'
  | 'SLA policies'
  | 'API keys'
  | 'Integrations'
  | 'Report templates'
  | 'All users'
  | 'Audit log'

export type Role = 'admin' | 'analyst' | 'readonly'

export const settingsSections: SettingsSection[] = [
  'My account',
  'Security',
  'Organisation',
  'Users & roles',
  'Profiles & permissions',
  'Custom fields',
  'Observable types',
  'Taxonomies & tags',
  'ATT&CK catalog',
  'Notifications',
  'SLA policies',
  'API keys',
  'Integrations',
  'Report templates',
  'All users',
  'Audit log',
]

// URL-friendly slugs so the active tab can live in the `?tab=` search param.
// e.g. 'Users & roles' -> 'users-roles', 'API keys' -> 'api-keys'.
export function sectionToSlug(section: SettingsSection): string {
  return section.toLowerCase().replace(/&/g, '').trim().replace(/\s+/g, '-')
}

const slugToSectionMap = new Map<string, SettingsSection>(
  settingsSections.map((section) => [sectionToSlug(section), section]),
)

export function slugToSection(slug: string): SettingsSection | undefined {
  return slugToSectionMap.get(slug)
}

// The permission catalog (rows/columns of the Profiles matrix) now comes from the
// backend via `permissionCatalogQueryOptions`, so the frontend and backend can't
// drift. The old hand-written `resources`/`verbs` arrays lived here.
