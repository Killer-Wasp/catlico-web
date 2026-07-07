export type SettingsSection =
  | 'My account'
  | 'Organisation'
  | 'Users & roles'
  | 'Profiles & permissions'
  | 'Custom fields'
  | 'Observable types'
  | 'Taxonomies & tags'
  | 'Notifications'
  | 'Connectors'
  | 'SLA policies'
  | 'API keys'
  | 'Integrations'
  | 'Audit log'

export type Role = 'admin' | 'analyst' | 'readonly'
export type IntegrationState = 'CONNECTED' | 'AUTH ERROR'

export const settingsSections: SettingsSection[] = [
  'My account',
  'Organisation',
  'Users & roles',
  'Profiles & permissions',
  'Custom fields',
  'Observable types',
  'Taxonomies & tags',
  'Notifications',
  'Connectors',
  'SLA policies',
  'API keys',
  'Integrations',
  'Audit log',
]

// URL-friendly slugs so the active tab can live in the `?tab=` search param.
// e.g. 'Users & roles' -> 'users-roles', 'API keys' -> 'api-keys'.
export function sectionToSlug(section: SettingsSection): string {
  return section
    .toLowerCase()
    .replace(/&/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const slugToSectionMap = new Map<string, SettingsSection>(
  settingsSections.map((section) => [sectionToSlug(section), section]),
)

export function slugToSection(slug: string): SettingsSection | undefined {
  return slugToSectionMap.get(slug)
}

export const resources = [
  [
    'Cases',
    [
      'read',
      'create',
      'update',
      'delete',
      'assign',
      'close',
      'merge',
      'share',
      'export',
      'import',
      'bulk',
    ],
  ],
  ['Tasks', ['read', 'create', 'update', 'delete', 'assign', 'close', 'bulk']],
  [
    'Observables',
    ['read', 'create', 'update', 'delete', 'export', 'import', 'bulk'],
  ],
  ['Alerts', ['read', 'create', 'update', 'delete', 'import']],
  ['Comments', ['read', 'create', 'update', 'delete']],
  ['Dashboards', ['read', 'create', 'update', 'delete']],
  ['Users', ['read', 'create', 'update', 'delete']],
  ['Profiles', ['read', 'create', 'update', 'delete']],
  ['Custom fields', ['read', 'create', 'update', 'delete']],
  ['Observable types', ['read', 'create', 'update', 'delete']],
  ['Taxonomies', ['read', 'create', 'update', 'delete']],
  ['Functions', ['read', 'create', 'update', 'delete', 'run']],
  ['Organisations', ['read', 'create', 'update', 'delete']],
] as const

export const verbs = [
  'read',
  'create',
  'update',
  'delete',
  'assign',
  'close',
  'merge',
  'share',
  'export',
  'import',
  'run',
  'bulk',
] as const
