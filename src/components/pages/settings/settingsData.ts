export type SettingsSection =
  | 'Organisation'
  | 'Organisations'
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
  'Organisation',
  'Organisations',
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

export const notificationRules = [
  ['New critical alert', 'Page the on-call analyst via Grafana OnCall', true],
  [
    'SLA breach imminent',
    'Notify case assignee 30 minutes before breach',
    true,
  ],
  ['Case assigned to me', 'In-app and email notification', true],
  [
    'Daily SOC digest',
    'Summary of alerts, cases and MTTR at 08:00 AEST',
    false,
  ],
  ['Cortex job failed', 'Notify the analyst who launched the job', true],
  ['MISP sync errors', 'Notify the intelligence team channel', false],
] as const

export const notifiers = [
  ['Slack', '#soc-alerts', true],
  ['Email', 'soc-oncall@originenergy.com.au', true],
  ['Webhook', 'https://hooks.origin.internal/catlico', false],
  ['Kafka', 'topic: catlico.events', true],
] as const

export const slaPolicies = [
  ['CRITICAL', '15m', '4h', 'On-call lead'],
  ['HIGH', '30m', '8h', 'On-call lead'],
  ['MEDIUM', '2h', '2d', 'Queue'],
  ['LOW', '1d', '5d', 'Queue'],
] as const

export const apiKeys = [
  ['splunk-forwarder', 'thp_**********3f9a', 'WRITE:ALERTS', '4m ago'],
  ['misp-sync', 'thp_**********81cc', 'READ/WRITE:OBS', '12m ago'],
  ['grafana-readonly', 'thp_**********b042', 'READ:METRICS', '1h ago'],
] as const
