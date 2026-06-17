import type { ReactNode } from 'react'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'

type SettingsSection =
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

type Role = 'admin' | 'analyst' | 'readonly'
type IntegrationState = 'CONNECTED' | 'AUTH ERROR'

const settingsSections: SettingsSection[] = [
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

const users = [
  ['J. Tanaka', 'j.tanaka@originenergy.com.au', 'admin', '4m ago'],
  ['P. Nguyen', 'p.nguyen@originenergy.com.au', 'analyst', '11m ago'],
  ['A. Whitford', 'a.whitford@originenergy.com.au', 'analyst', '38m ago'],
  ['S. Iyer', 's.iyer@originenergy.com.au', 'analyst', '2h ago'],
  ['Grafana service', 'svc-grafana@originenergy.com.au', 'readonly', '1h ago'],
] as const

const orgs = [
  {
    name: 'Catlico Security Operations',
    short: 'origin-soc',
    desc: 'Primary SOC tenant',
    members: 5,
    cases: 8,
    created: 'baseline',
  },
  {
    name: 'Generation / OT SOC',
    short: 'origin-ot',
    desc: 'OT and generation monitoring',
    members: 2,
    cases: 2,
    created: '2026-01-15',
  },
  {
    name: 'Managed Partner - Acme',
    short: 'partner-acme',
    desc: 'External MSSP partner (share-only)',
    members: 4,
    cases: 0,
    created: '2026-03-20',
  },
] as const

const orgLinks = [
  ['Catlico Security Operations', 'Generation / OT SOC'],
  ['Catlico Security Operations', 'Managed Partner - Acme'],
] as const

const profiles = [
  { name: 'read-only', members: 1, permissions: 15 },
  { name: 'analyst', members: 3, permissions: 27 },
  { name: 'senior-analyst', members: 1, permissions: 44 },
  { name: 'org-admin', members: 1, permissions: 55 },
  { name: 'platform-admin', members: 1, permissions: 72 },
] as const

const resources = [
  ['Cases', ['read', 'create', 'update', 'delete', 'assign', 'close', 'merge', 'share', 'export', 'import', 'bulk']],
  ['Tasks', ['read', 'create', 'update', 'delete', 'assign', 'close', 'bulk']],
  ['Observables', ['read', 'create', 'update', 'delete', 'export', 'import', 'bulk']],
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

const verbs = [
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

const customFields = [
  ['Affected users', 'affected_users', 'integer', 'optional', 'no', '4 cases'],
  ['Campaign ID', 'campaign_id', 'string', 'optional', 'no', '7 cases'],
  ['Financial exposure (AUD)', 'financial_exposure', 'integer', 'optional', 'no', '2 cases'],
  ['Data classification', 'data_classification', 'string', 'required', 'no', '11 cases'],
  ['Affected hostnames', 'affected_hostnames', 'string', 'optional', 'yes', '5 cases'],
  ['Containment confirmed', 'containment_confirmed', 'boolean', 'optional', 'no', '6 cases'],
] as const

const observableTypes = [
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

const taxonomies = [
  ['tlp', '2.0', '4 predicates', true],
  ['misp-galaxy:threat-actor', '2024-09', '512 predicates', true],
  ['kill-chain', '1.0', '7 predicates', true],
  ['diamond-model', '1.0', '4 predicates', false],
  ['dni-ate', '1.1', '24 predicates', false],
  ['PAP', '1.0', '4 predicates', true],
] as const

const freetags = [
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

const notificationRules = [
  ['New critical alert', 'Page the on-call analyst via Grafana OnCall', true],
  ['SLA breach imminent', 'Notify case assignee 30 minutes before breach', true],
  ['Case assigned to me', 'In-app and email notification', true],
  ['Daily SOC digest', 'Summary of alerts, cases and MTTR at 08:00 AEST', false],
  ['Cortex job failed', 'Notify the analyst who launched the job', true],
  ['MISP sync errors', 'Notify the intelligence team channel', false],
] as const

const notifiers = [
  ['Slack', '#soc-alerts', true],
  ['Email', 'soc-oncall@originenergy.com.au', true],
  ['Webhook', 'https://hooks.origin.internal/catlico', false],
  ['Kafka', 'topic: catlico.events', true],
] as const

const mispConnectors = [
  ['MISP - Origin CTI', 'https://misp.origin.internal', 'ImportAndExport', '1h', '12 min ago'],
  ['MISP - AusCERT', 'https://misp.auscert.org.au', 'ImportOnly', '6h', '2h ago'],
] as const

const cortexServers = [
  ['Cortex - primary', 'https://cortex.origin.internal', '14 analyzers', '5 min ago'],
] as const

const slaPolicies = [
  ['CRITICAL', '15m', '4h', 'On-call lead'],
  ['HIGH', '30m', '8h', 'On-call lead'],
  ['MEDIUM', '2h', '2d', 'Queue'],
  ['LOW', '1d', '5d', 'Queue'],
] as const

const apiKeys = [
  ['splunk-forwarder', 'thp_**********3f9a', 'WRITE:ALERTS', '4m ago'],
  ['misp-sync', 'thp_**********81cc', 'READ/WRITE:OBS', '12m ago'],
  ['grafana-readonly', 'thp_**********b042', 'READ:METRICS', '1h ago'],
] as const

const integrations = [
  ['DX', 'Defender XDR', 'alert feed - graph API', 'CONNECTED', 'blue'],
  ['SP', 'Splunk ES', 'notable events forwarder', 'CONNECTED', 'green'],
  ['CS', 'CrowdStrike Falcon', 'detections + RTR responder', 'CONNECTED', 'red'],
  ['PP', 'Proofpoint TAP', 'clicks + message events', 'CONNECTED', 'yellow'],
  ['MI', 'MISP', 'bidirectional IOC sync', 'CONNECTED', 'violet'],
  ['GR', 'Grafana OnCall', 'paging + escalation', 'AUTH ERROR', 'orange'],
] as const

const auditEvents = [
  ['10:33:10', 'P. Nguyen', 'observable.create', 'Observable', 'obs:cdn-au-billing', 'origin-soc'],
  ['10:32:40', 'fn-webhook-intake', 'alert.create', 'Alert', 'AL-9123', 'origin-soc'],
  ['10:31:02', 'AbuseIPDB', 'case.add_tag', 'Case', '#1842', 'origin-soc'],
  ['10:08:00', 'J. Tanaka', 'task.update', 'Task', 'T-1843-4', 'origin-soc'],
  ['09:54:00', 'J. Tanaka', 'responder.run', 'Case', '#1842', 'origin-soc'],
  ['09:41:00', 'J. Tanaka', 'share.create', 'CaseShare', '#1842 -> origin-retail', 'origin-soc'],
  ['09:26:00', 'J. Tanaka', 'case.update', 'Case', '#1842', 'origin-soc'],
  ['09:12:00', 'J. Tanaka', 'case.create', 'Case', '#1842', 'origin-soc'],
  ['08:30:00', 'S. Iyer', 'membership.update', 'Membership', 'a.whitford@origin', 'origin-soc'],
] as const

function useStamp() {
  const [stamp, setStamp] = useState('')

  useEffect(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Australia/Sydney',
    })
    const time = now
      .toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
      })
      .toLowerCase()
    setStamp(`${date}, ${time} AEST`)
  }, [])

  return stamp
}

function notify(message: string) {
  notifications.show({ color: 'orange', message })
}

function SettingsSectionButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      fz={13}
      fw={600}
      c={active ? 'var(--text)' : 'var(--muted)'}
      px={12}
      py={8}
      style={(theme) => ({
        borderRadius: theme.radius.md,
        background: active
          ? `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`
          : undefined,
      })}
    >
      {label}
    </UnstyledButton>
  )
}

function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper radius="md" shadow="sm" p={0}>
      <Group
        px={18}
        py={14}
        wrap="nowrap"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Title order={2} fz={15}>
          {title}
        </Title>
        {count !== undefined && (
          <Badge variant="default" color="gray" radius="xl" ff="monospace">
            {count}
          </Badge>
        )}
        {action && <Group ml="auto">{action}</Group>}
      </Group>
      {children}
    </Paper>
  )
}

function TableBox({ children }: { children: ReactNode }) {
  return <Box style={{ overflowX: 'auto' }}>{children}</Box>
}

function RoleBadge({ role }: { role: Role | string }) {
  const color =
    role === 'admin' || role === 'org-admin'
      ? 'orange'
      : role === 'readonly' || role === 'read-only'
        ? 'gray'
        : 'blue'

  return (
    <Badge color={color} variant="light" radius="xl" ff="monospace">
      {role.toUpperCase()}
    </Badge>
  )
}

function StatusBadge({ state }: { state: IntegrationState | string }) {
  return (
    <Badge
      color={state === 'AUTH ERROR' || state === 'PAUSED' ? 'red' : 'green'}
      variant="light"
      radius="xl"
      ff="monospace"
    >
      {state}
    </Badge>
  )
}

function OrgProfilePanel() {
  return (
    <Panel title="Organisation profile">
      <Box p={18}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={18} verticalSpacing={16}>
          <TextInput label="Organisation name" defaultValue="Catlico Security Operations" />
          <TextInput
            label="Org short name"
            defaultValue="origin-soc"
            styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }}
          />
          <Select
            label="Timezone"
            data={['Australia/Sydney (AEST)', 'UTC']}
            defaultValue="Australia/Sydney (AEST)"
            allowDeselect={false}
          />
          <Select
            label="Default case TLP"
            data={['TLP:AMBER', 'TLP:GREEN', 'TLP:RED']}
            defaultValue="TLP:AMBER"
            allowDeselect={false}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="md">
          <Button color="orange" onClick={() => notify('Organisation profile saved')}>
            Save changes
          </Button>
        </Group>
      </Box>
    </Panel>
  )
}

function OrganisationsPanel() {
  return (
    <Stack gap="md">
      <Panel
        title="Organisations"
        count={orgs.length}
        action={
          <Button variant="default" onClick={() => notify('New organisation workflow opened')}>
            + New organisation
          </Button>
        }
      >
        <TableBox>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Organisation</Table.Th>
                <Table.Th>Short name</Table.Th>
                <Table.Th>Members</Table.Th>
                <Table.Th>Cases</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orgs.map((org) => (
                <Table.Tr key={org.short}>
                  <Table.Td>
                    <Text fw={700}>{org.name}</Text>
                    <Text fz={12} c="var(--muted)">
                      {org.desc}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Code>{org.short}</Code>
                  </Table.Td>
                  <Table.Td ff="monospace">{org.members}</Table.Td>
                  <Table.Td ff="monospace">{org.cases}</Table.Td>
                  <Table.Td ff="monospace" c="var(--faint)">
                    {org.created}
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="default">
                      Manage
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableBox>
      </Panel>

      <Panel title="Organisation links" count="who can share with whom">
        <Stack gap={8} p={18}>
          {orgLinks.map(([from, to]) => (
            <Group key={`${from}-${to}`} gap="sm">
              <Text fz={13}>{from}</Text>
              <Text ff="monospace" c="orange.7">
                -&gt;
              </Text>
              <Text fz={13} flex={1}>
                {to}
              </Text>
              <StatusBadge state="CAN SHARE" />
            </Group>
          ))}
        </Stack>
      </Panel>
    </Stack>
  )
}

function UsersPanel() {
  return (
    <Panel
      title="Members"
      count={users.length}
      action={
        <Button variant="default" onClick={() => notify('Invite user workflow opened')}>
          + Invite user
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Last active</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map(([name, email, role, lastActive]) => (
              <Table.Tr key={email}>
                <Table.Td fw={700}>{name}</Table.Td>
                <Table.Td>
                  <Code>{email}</Code>
                </Table.Td>
                <Table.Td>
                  <RoleBadge role={role} />
                </Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {lastActive}
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="default">
                    Edit
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}

function ProfilesPanel() {
  const [profile, setProfile] = useState('analyst')
  const activeProfile = profiles.find((item) => item.name === profile) ?? profiles[1]

  return (
    <Panel
      title="Profiles"
      count={profiles.length}
      action={
        <Button variant="default" onClick={() => notify('New profile workflow opened')}>
          + New profile
        </Button>
      }
    >
      <Box p={18}>
        <Group gap={8} mb="md">
          {profiles.map((item) => (
            <Button
              key={item.name}
              variant={item.name === profile ? 'light' : 'default'}
              color={item.name === profile ? 'orange' : 'gray'}
              size="xs"
              onClick={() => setProfile(item.name)}
            >
              {item.name}
            </Button>
          ))}
        </Group>
        <Text ff="monospace" fz={11} c="var(--faint)" mb="sm">
          built-in profile - {activeProfile.members} member
          {activeProfile.members === 1 ? '' : 's'} - {activeProfile.permissions}{' '}
          effective permissions
        </Text>
        <TableBox>
          <Table verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Resource</Table.Th>
                {verbs.map((verb) => (
                  <Table.Th key={verb} ta="center">
                    {verb}
                  </Table.Th>
                ))}
                <Table.Th>scope</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resources.map(([resource, allowed]) => (
                <Table.Tr key={resource}>
                  <Table.Td ff="monospace" fw={700}>
                    {resource}
                  </Table.Td>
                  {verbs.map((verb) => (
                    <Table.Td key={`${resource}-${verb}`} ta="center">
                      {allowed.includes(verb) ? (
                        <Checkbox
                          defaultChecked={
                            verb === 'read' ||
                            (profile !== 'read-only' &&
                              ['create', 'update'].includes(verb))
                          }
                          aria-label={`${profile} ${verb} ${resource}`}
                        />
                      ) : (
                        <Text c="var(--faint)">.</Text>
                      )}
                    </Table.Td>
                  ))}
                  <Table.Td>
                    {resource === 'Cases' || resource === 'Tasks' ? (
                      <Select
                        data={['any', 'own']}
                        defaultValue="any"
                        allowDeselect={false}
                        size="xs"
                        w={90}
                        aria-label={`${resource} scope`}
                      />
                    ) : (
                      <Text c="var(--faint)">.</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableBox>
        <Group justify="flex-end" mt="md">
          <Text ff="monospace" fz={11} c="var(--faint)" mr="auto">
            admin-plane rows shown in orange - platform rows need the admin org
          </Text>
          <Button color="orange" onClick={() => notify(`Profile ${profile} saved`)}>
            Save profile
          </Button>
        </Group>
      </Box>
    </Panel>
  )
}

function CustomFieldsPanel() {
  return (
    <Panel
      title="Custom field definitions"
      count={customFields.length}
      action={
        <Button variant="default" onClick={() => notify('Add custom field workflow opened')}>
          + Add field
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Key</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Mandatory</Table.Th>
              <Table.Th>Multi-value</Table.Th>
              <Table.Th>Used by</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {customFields.map(([label, key, type, mandatory, multi, usage]) => (
              <Table.Tr key={key}>
                <Table.Td fw={700}>{label}</Table.Td>
                <Table.Td>
                  <Code>{key}</Code>
                </Table.Td>
                <Table.Td>
                  <Badge variant="default">{type}</Badge>
                </Table.Td>
                <Table.Td c={mandatory === 'required' ? 'yellow.7' : 'dimmed'}>
                  {mandatory}
                </Table.Td>
                <Table.Td>{multi}</Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {usage}
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="default">
                    Delete
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}

function ObservableTypesPanel() {
  return (
    <Panel
      title="Observable types"
      count={observableTypes.length}
      action={
        <Button variant="default" onClick={() => notify('Add observable type workflow opened')}>
          + Add type
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Validation regex</Table.Th>
              <Table.Th>Origin</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {observableTypes.map(([name, regex, origin]) => (
              <Table.Tr key={name}>
                <Table.Td>
                  <Badge variant="default">{name}</Badge>
                </Table.Td>
                <Table.Td>
                  <Code>{regex}</Code>
                </Table.Td>
                <Table.Td>
                  <RoleBadge role={origin === 'BUILT-IN' ? 'readonly' : 'analyst'} />
                </Table.Td>
                <Table.Td>
                  {origin === 'CUSTOM' && (
                    <Button size="xs" variant="default">
                      Delete
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}

function TaxonomiesPanel() {
  return (
    <Stack gap="md">
      <Panel
        title="Taxonomies"
        count={`${taxonomies.filter(([, , , enabled]) => enabled).length} enabled`}
        action={
          <Button variant="default" onClick={() => notify('MISP taxonomy import opened')}>
            Import MISP taxonomy
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {taxonomies.map(([namespace, version, predicates, enabled]) => (
            <Group
              key={namespace}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Box flex={1}>
                <Text ff="monospace" fz={13} fw={700}>
                  {namespace}
                </Text>
                <Text fz={12} c="var(--muted)">
                  v{version} - {predicates}
                </Text>
              </Box>
              <Switch defaultChecked={enabled} aria-label={`${namespace} enabled`} />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel title="Org freetags" count={freetags.length}>
        <Group gap={6} p={18}>
          {freetags.map((tag) => (
            <Badge key={tag} variant="default" color="gray" ff="monospace">
              {tag}
            </Badge>
          ))}
          <Button size="xs" variant="default" onClick={() => notify('Add freetag workflow opened')}>
            + add
          </Button>
        </Group>
      </Panel>
    </Stack>
  )
}

function NotificationsPanel() {
  const [preview, setPreview] = useState('- preview renders here -')
  const template =
    '{{event.action}} - {{entity.id}} {{entity.title}}\nseverity: {{entity.severity}} - org: {{event.org}} - by {{event.actor}}'

  return (
    <Stack gap="md">
      <Panel title="Notification rules">
        <Stack gap={0} p={18} pt={6} pb={6}>
          {notificationRules.map(([name, description, enabled]) => (
            <Group
              key={name}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {name}
                </Text>
                <Text fz={12} c="var(--muted)">
                  {description}
                </Text>
              </Box>
              <Switch defaultChecked={enabled} aria-label={`${name} enabled`} />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Notifiers"
        count={`${notifiers.filter(([, , enabled]) => enabled).length} active`}
        action={
          <Button variant="default" onClick={() => notify('Add notifier workflow opened')}>
            + Add notifier
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {notifiers.map(([type, destination, enabled]) => (
            <Group
              key={destination}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="default" color="gray" miw={38}>
                {type.slice(0, 2).toUpperCase()}
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {type}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {destination}
                </Text>
              </Box>
              <Button size="xs" variant="default">
                Test
              </Button>
              <Switch defaultChecked={enabled} aria-label={`${type} notifier enabled`} />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Message template"
        count="handlebars"
        action={
          <Button
            variant="default"
            onClick={() =>
              setPreview(
                'case.create - #1842 OAuth consent grant - privileged account compromise\nseverity: HIGH - org: origin-soc - by J. Tanaka',
              )
            }
          >
            Preview with sample event
          </Button>
        }
      >
        <Box p={18}>
          <Textarea
            aria-label="Notification message template"
            rows={4}
            defaultValue={template}
            styles={{ input: { fontFamily: 'monospace' } }}
          />
          <Paper mt="sm" p="sm" bg="gray.0" withBorder>
            <Text ff="monospace" fz={12} c="green.8" style={{ whiteSpace: 'pre-wrap' }}>
              {preview}
            </Text>
          </Paper>
        </Box>
      </Panel>
    </Stack>
  )
}

function ConnectorsPanel() {
  return (
    <Stack gap="md">
      <Panel
        title="MISP connectors"
        count={mispConnectors.length}
        action={
          <Button variant="default" onClick={() => notify('Add MISP server workflow opened')}>
            + Add MISP server
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {mispConnectors.map(([name, url, purpose, interval, last]) => (
            <Group
              key={url}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="light" color="violet" miw={38}>
                MI
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {name}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {url} - {purpose} - every {interval} - synced {last}
                </Text>
              </Box>
              <StatusBadge state="ENABLED" />
              <Button size="xs" variant="default">
                Test
              </Button>
              <Button size="xs" variant="default">
                Configure
              </Button>
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Cortex servers"
        count={cortexServers.length}
        action={
          <Button variant="default" onClick={() => notify('Add Cortex server workflow opened')}>
            + Add Cortex server
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {cortexServers.map(([name, url, analyzers, last]) => (
            <Group
              key={url}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="light" color="violet" miw={38}>
                CX
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {name}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {url} - {analyzers} - refreshed {last}
                </Text>
              </Box>
              <StatusBadge state="ONLINE" />
              <Button size="xs" variant="default">
                Refresh catalog
              </Button>
              <Button size="xs" variant="default">
                Configure
              </Button>
            </Group>
          ))}
        </Stack>
      </Panel>
    </Stack>
  )
}

function SlaPanel() {
  return (
    <Panel title="SLA policies" count="per severity">
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Time to acknowledge</Table.Th>
              <Table.Th>Time to resolve</Table.Th>
              <Table.Th>Escalate to</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {slaPolicies.map(([severity, acknowledge, resolve, escalate]) => (
              <Table.Tr key={severity}>
                <Table.Td>
                  <Text ff="monospace" fw={700} c={severity === 'CRITICAL' ? 'red.7' : 'orange.7'}>
                    {severity}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${severity[0]}${severity.slice(1).toLowerCase()} time to acknowledge`}
                    defaultValue={acknowledge}
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${severity[0]}${severity.slice(1).toLowerCase()} time to resolve`}
                    defaultValue={resolve}
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    data={['On-call lead', 'CISO', 'Queue']}
                    defaultValue={escalate}
                    allowDeselect={false}
                    w={180}
                    aria-label={`${severity} escalation`}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
      <Group justify="flex-end" p={18} pt={0}>
        <Button color="orange" onClick={() => notify('SLA policies saved')}>
          Save SLA policies
        </Button>
      </Group>
    </Panel>
  )
}

function ApiKeysPanel() {
  return (
    <Panel
      title="API keys"
      action={
        <Button variant="default" onClick={() => notify('API key generated - shown once')}>
          + Generate key
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Key</Table.Th>
              <Table.Th>Scope</Table.Th>
              <Table.Th>Last used</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {apiKeys.map(([label, key, scope, lastUsed]) => (
              <Table.Tr key={label}>
                <Table.Td>{label}</Table.Td>
                <Table.Td>
                  <Code>{key}</Code>
                </Table.Td>
                <Table.Td>
                  <RoleBadge role={scope.includes('READ:METRICS') ? 'readonly' : 'analyst'} />
                  <Text component="span" ml={6} ff="monospace" fz={11}>
                    {scope}
                  </Text>
                </Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {lastUsed}
                </Table.Td>
                <Table.Td>
                  <Button size="xs" variant="default">
                    Revoke
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}

function IntegrationsPanel() {
  return (
    <Panel title="Connected integrations">
      <Stack gap={0} p={18} pt={6} pb={6}>
        {integrations.map(([initials, name, description, state, color]) => (
          <Group
            key={name}
            py={12}
            style={{ borderBottom: '1px solid var(--line-soft)' }}
          >
            <Badge variant="light" color={color} miw={38}>
              {initials}
            </Badge>
            <Box flex={1}>
              <Text fz={13} fw={700}>
                {name}
              </Text>
              <Text ff="monospace" fz={11} c="var(--faint)">
                {description}
              </Text>
            </Box>
            <StatusBadge state={state} />
            <Button size="xs" variant="default">
              {state === 'AUTH ERROR' ? 'Reconnect' : 'Configure'}
            </Button>
          </Group>
        ))}
      </Stack>
    </Panel>
  )
}

function AuditLogPanel() {
  return (
    <Panel
      title="Audit log"
      count={`${auditEvents.length} events`}
      action={
        <Button variant="default" onClick={() => notify('Audit log exported - audit-log.csv')}>
          Export CSV
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Entity</Table.Th>
              <Table.Th>Object</Table.Th>
              <Table.Th>Org</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {auditEvents.map(([time, actor, action, entity, object, org]) => (
              <Table.Tr key={`${time}-${action}-${object}`}>
                <Table.Td ff="monospace" c="var(--faint)">
                  {time}
                </Table.Td>
                <Table.Td>{actor}</Table.Td>
                <Table.Td>
                  <Code>{action}</Code>
                </Table.Td>
                <Table.Td>{entity}</Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {object}
                </Table.Td>
                <Table.Td>
                  <Code>{org}</Code>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}

function CurrentPanel({ section }: { section: SettingsSection }) {
  if (section === 'Organisations') return <OrganisationsPanel />
  if (section === 'Users & roles') return <UsersPanel />
  if (section === 'Profiles & permissions') return <ProfilesPanel />
  if (section === 'Custom fields') return <CustomFieldsPanel />
  if (section === 'Observable types') return <ObservableTypesPanel />
  if (section === 'Taxonomies & tags') return <TaxonomiesPanel />
  if (section === 'Notifications') return <NotificationsPanel />
  if (section === 'Connectors') return <ConnectorsPanel />
  if (section === 'SLA policies') return <SlaPanel />
  if (section === 'API keys') return <ApiKeysPanel />
  if (section === 'Integrations') return <IntegrationsPanel />
  if (section === 'Audit log') return <AuditLogPanel />
  return <OrgProfilePanel />
}

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('Organisation')
  const stamp = useStamp()

  return (
    <Box className={classes.page}>
      <Group align="baseline" gap={16} mb={26} wrap="wrap">
        <Title order={1}>Settings</Title>
        <Text ff="monospace" fz={12} c="var(--faint)">
          {stamp}
        </Text>
      </Group>

      <Box className={classes.settingsLayout}>
        <Stack
          component="nav"
          aria-label="Settings sections"
          gap={2}
          style={{ position: 'sticky', top: 84 }}
        >
          {settingsSections.map((section) => (
            <SettingsSectionButton
              key={section}
              label={section}
              active={section === activeSection}
              onClick={() => setActiveSection(section)}
            />
          ))}
        </Stack>

        <Box miw={0}>
          <CurrentPanel section={activeSection} />
        </Box>
      </Box>
    </Box>
  )
}
