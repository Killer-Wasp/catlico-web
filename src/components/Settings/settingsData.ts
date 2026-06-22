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

export const orgLinks = [
  ['Catlico Security Operations', 'Generation / OT SOC'],
  ['Catlico Security Operations', 'Managed Partner - Acme'],
] as const

export const profiles = [
  { name: 'read-only', members: 1, permissions: 15 },
  { name: 'analyst', members: 3, permissions: 27 },
  { name: 'senior-analyst', members: 1, permissions: 44 },
  { name: 'org-admin', members: 1, permissions: 55 },
  { name: 'platform-admin', members: 1, permissions: 72 },
] as const

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

export const observableTypes = [
  ['ip', '^\\d{1,3}(\\.\\d{1,3}){3}$', 'BUILT-IN'],
  ['domain', '^([a-z0-9-]+\\.)+[a-z]{2,}$', 'BUILT-IN'],
  ['fqdn', '^([a-z0-9-]+\\.)+[a-z]{2,}$', 'BUILT-IN'],
  ['url', '^https?://', 'BUILT-IN'],
  ['hash', '^[a-f0-9]{32,64}$', 'BUILT-IN'],
  ['file', '- none -', 'BUILT-IN'],
  ['mail', '^[^@]+@[^@]+$', 'BUILT-IN'],
  ['hostname', '^[A-Za-z0-9-]+$', 'BUILT-IN'],
  ['user-agent', '- none -', 'CUSTOM'],
  ['btc-address', '^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$', 'CUSTOM'],
  ['cve', '^CVE-\\d{4}-\\d{4,}$', 'CUSTOM'],
  ['ja4-fingerprint', '- none -', 'CUSTOM'],
] as const

export const taxonomies = [
  ['tlp', '2.0', '4 predicates', true],
  ['misp-galaxy:threat-actor', '2024-09', '512 predicates', true],
  ['kill-chain', '1.0', '7 predicates', true],
  ['diamond-model', '1.0', '4 predicates', false],
  ['dni-ate', '1.1', '24 predicates', false],
  ['PAP', '1.0', '4 predicates', true],
] as const

export const freetags = [
  'phishing',
  'bec',
  'ransomware',
  'identity',
  'ot-segment',
  'hygiene',
  'finance',
  'insider',
  'ioc-match',
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

export const auditEvents = [
  [
    '10:33:10',
    'P. Nguyen',
    'observable.create',
    'Observable',
    'obs:cdn-au-billing',
    'origin-soc',
  ],
  [
    '10:32:40',
    'fn-webhook-intake',
    'alert.create',
    'Alert',
    'AL-9123',
    'origin-soc',
  ],
  ['10:31:02', 'AbuseIPDB', 'case.add_tag', 'Case', '#1842', 'origin-soc'],
  ['10:08:00', 'J. Tanaka', 'task.update', 'Task', 'T-1843-4', 'origin-soc'],
  ['09:54:00', 'J. Tanaka', 'responder.run', 'Case', '#1842', 'origin-soc'],
  [
    '09:41:00',
    'J. Tanaka',
    'share.create',
    'CaseShare',
    '#1842 -> origin-retail',
    'origin-soc',
  ],
  ['09:26:00', 'J. Tanaka', 'case.update', 'Case', '#1842', 'origin-soc'],
  ['09:12:00', 'J. Tanaka', 'case.create', 'Case', '#1842', 'origin-soc'],
  [
    '08:30:00',
    'S. Iyer',
    'membership.update',
    'Membership',
    'a.whitford@origin',
    'origin-soc',
  ],
] as const
