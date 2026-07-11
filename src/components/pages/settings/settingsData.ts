export type SettingsSection =
  | 'My account'
  | 'Organisation'
  | 'Users & roles'
  | 'Profiles & permissions'
  | 'Custom fields'
  | 'Observable types'
  | 'Taxonomies & tags'
  | 'Notifications'
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
  'SLA policies',
  'API keys',
  'Integrations',
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

// The grantable permission vocabulary the API accepts. This mirrors the coarse
// `Permission` enum in catlico-api (`app/models/role.py`): roles are granted these
// domain-grouped strings, and the backend expands each to the fine-grained
// capabilities its route guards check. Anything not in this set is rejected by
// FastAPI validation, so the UI must build permission strings only from here.

export type PermissionVerb = 'read' | 'write' | 'run'

export type PermissionCell = {
  verb: PermissionVerb
  // The exact grant string sent to / stored by the API, e.g. 'read:investigation'.
  permission: string
}

export type PermissionGroup = {
  domain: string
  description: string
  cells: PermissionCell[]
}

// Column order for the profiles permission grid.
export const permissionVerbs: PermissionVerb[] = ['read', 'write', 'run']

export const permissionGroups: PermissionGroup[] = [
  {
    domain: 'Investigation',
    description: 'Cases, tasks, observables and alerts',
    cells: [
      { verb: 'read', permission: 'read:investigation' },
      { verb: 'write', permission: 'write:investigation' },
    ],
  },
  {
    domain: 'Intel',
    description: 'Custom fields, knowledge base and functions',
    cells: [
      { verb: 'read', permission: 'read:intel' },
      { verb: 'write', permission: 'write:intel' },
    ],
  },
  {
    domain: 'Enrichment',
    description: 'Run enrichment on observables',
    cells: [{ verb: 'run', permission: 'run:enrichment' }],
  },
  {
    domain: 'Functions',
    description: 'Execute automation functions',
    cells: [{ verb: 'run', permission: 'run:function' }],
  },
  {
    domain: 'Organisation',
    description: 'Organisation profile and connectors',
    cells: [
      { verb: 'read', permission: 'read:org' },
      { verb: 'write', permission: 'write:org' },
    ],
  },
  {
    domain: 'Access',
    description: 'Users and roles',
    cells: [
      { verb: 'read', permission: 'read:access' },
      { verb: 'write', permission: 'write:access' },
    ],
  },
]

// Every grantable permission string, in stable order — used e.g. to seed a
// read-only starter role.
export const grantablePermissions: string[] = permissionGroups.flatMap(
  (group) => group.cells.map((cell) => cell.permission),
)
