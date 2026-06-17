import classes from '#/components/Cases/CasesPage.module.css'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Play, X } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useMemo, useState } from 'react'

type FunctionTrigger = 'scheduled' | 'event' | 'manual' | 'api'
type FunctionRuntime = 'javascript' | 'python'

type FunctionRun = {
  status: 'success' | 'failure'
  trigger: FunctionTrigger
  started: string
  duration: string
  attempts: number
  error?: string
}

type FunctionAutomation = {
  id: string
  name: string
  description: string
  runtime: FunctionRuntime
  trigger: FunctionTrigger
  triggerConfig: {
    cron?: string
    condition?: string
    entities?: string[]
  }
  profile: string
  enabled: boolean
  timeout: number
  egress: string
  approval: boolean
  code: string
  secrets: string[]
  runCount: number
  errorCount: number
  runs: FunctionRun[]
}

const sampleCode = `// runs as the pinned profile; ctx is the SDK
export async function handler(ctx, event) {
  const obs = event.observable;
  if (obs.dataType !== "ip") return;
  const rep = await ctx.analyzers.run("AbuseIPDB", obs);
  if (rep.verdict === "malicious") {
    await ctx.case.addTag(event.caseId, "auto:malicious-ip");
    await ctx.notify.slack("#soc-alerts",
      \`Malicious IP \${obs.data} auto-tagged on \${event.caseId}\`);
  }
}`

const initialFunctions: FunctionAutomation[] = [
  {
    id: 'fn-enrich-ip',
    name: 'Auto-enrich new IP observables',
    description:
      'On every new IP observable, run AbuseIPDB and tag the case if malicious.',
    runtime: 'javascript',
    trigger: 'event',
    triggerConfig: { condition: 'observable.dataType == "ip"' },
    profile: 'analyst',
    enabled: true,
    timeout: 15000,
    egress: 'api.abuseipdb.com, hooks.slack.com',
    approval: false,
    code: sampleCode,
    secrets: ['ABUSEIPDB_KEY', 'SLACK_TOKEN'],
    runCount: 412,
    errorCount: 3,
    runs: [
      {
        status: 'success',
        trigger: 'event',
        started: '10:31:02',
        duration: '0.9s',
        attempts: 1,
      },
      {
        status: 'success',
        trigger: 'event',
        started: '10:24:51',
        duration: '1.1s',
        attempts: 1,
      },
      {
        status: 'failure',
        trigger: 'event',
        started: '09:58:10',
        duration: '30s',
        attempts: 3,
        error: 'timeout',
      },
    ],
  },
  {
    id: 'fn-soc-digest',
    name: 'Daily SOC digest',
    description:
      'Posts an 08:00 summary of open cases, new alerts and MTTR to Slack.',
    runtime: 'javascript',
    trigger: 'scheduled',
    triggerConfig: { cron: '0 8 * * *' },
    profile: 'read-only',
    enabled: true,
    timeout: 30000,
    egress: 'hooks.slack.com',
    approval: false,
    code: '// build digest...',
    secrets: ['SLACK_TOKEN'],
    runCount: 88,
    errorCount: 0,
    runs: [
      {
        status: 'success',
        trigger: 'scheduled',
        started: '08:00:01',
        duration: '2.4s',
        attempts: 1,
      },
    ],
  },
  {
    id: 'fn-isolate',
    name: 'Isolate host on confirmed ransomware',
    description:
      'Manual action - network-contains the host via CrowdStrike RTR.',
    runtime: 'javascript',
    trigger: 'manual',
    triggerConfig: { entities: ['cases', 'observables'] },
    profile: 'senior-analyst',
    enabled: false,
    timeout: 20000,
    egress: 'api.crowdstrike.com',
    approval: true,
    code: '// RTR isolate...',
    secrets: ['CS_CLIENT_ID', 'CS_SECRET'],
    runCount: 12,
    errorCount: 0,
    runs: [
      {
        status: 'success',
        trigger: 'manual',
        started: 'yesterday 14:02',
        duration: '6.0s',
        attempts: 1,
      },
    ],
  },
  {
    id: 'fn-webhook-intake',
    name: 'Partner IOC webhook intake',
    description: 'API-triggered - accepts partner IOCs and raises an alert.',
    runtime: 'python',
    trigger: 'api',
    triggerConfig: {},
    profile: 'analyst',
    enabled: true,
    timeout: 10000,
    egress: '',
    approval: false,
    code: '# parse payload, create alert...',
    secrets: [],
    runCount: 1903,
    errorCount: 21,
    runs: [
      {
        status: 'success',
        trigger: 'api',
        started: '10:32:40',
        duration: '0.3s',
        attempts: 1,
      },
    ],
  },
]

const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 11,
  fw: 600,
  c: 'dimmed',
  lts: '1px',
} as const

const profileOptions = ['analyst', 'read-only', 'senior-analyst', 'org-admin']

function cloneFunction(fn: FunctionAutomation): FunctionAutomation {
  return JSON.parse(JSON.stringify(fn)) as FunctionAutomation
}

function newFunction(): FunctionAutomation {
  return {
    id: '',
    name: '',
    description: '',
    runtime: 'javascript',
    trigger: 'event',
    triggerConfig: { condition: '' },
    profile: 'analyst',
    enabled: false,
    timeout: 15000,
    egress: '',
    approval: false,
    code: sampleCode,
    secrets: [],
    runCount: 0,
    errorCount: 0,
    runs: [],
  }
}

function TriggerBadge({ trigger }: { trigger: FunctionTrigger }) {
  const color =
    trigger === 'event'
      ? 'violet'
      : trigger === 'scheduled'
        ? 'blue'
        : trigger === 'manual'
          ? 'yellow'
          : 'green'

  return (
    <Badge
      variant="light"
      color={color}
      radius="sm"
      size="sm"
      ff="monospace"
      tt="lowercase"
    >
      {trigger}
    </Badge>
  )
}

function ProfileBadge({ profile }: { profile: string }) {
  const color = profile === 'read-only' ? 'gray' : 'blue'

  return (
    <Badge
      variant="light"
      color={color}
      radius="xl"
      size="md"
      ff="monospace"
      tt="lowercase"
      w={170}
      styles={{ label: { textTransform: 'none' } }}
    >
      {profile}
    </Badge>
  )
}

function StatusBadge({ status }: { status: FunctionRun['status'] }) {
  return (
    <Badge
      variant="light"
      color={status === 'success' ? 'lime' : 'red'}
      radius="sm"
      size="sm"
      ff="monospace"
      tt="lowercase"
    >
      {status}
    </Badge>
  )
}

function Panel({
  title,
  badge,
  right,
  children,
}: {
  title: string
  badge?: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper withBorder radius="md" shadow="sm" bg="body" style={{ overflow: 'hidden' }}>
      <Group
        justify="space-between"
        px="lg"
        py="md"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Group gap="sm">
          <Title order={2} size="h4">
            {title}
          </Title>
          {badge ? (
            <Badge variant="default" color="gray" radius="xl" ff="monospace">
              {badge}
            </Badge>
          ) : null}
        </Group>
        {right}
      </Group>
      {children}
    </Paper>
  )
}

function PageHead({
  title,
  stamp,
  actions,
}: {
  title: string
  stamp: string
  actions: ReactNode
}) {
  return (
    <Group justify="space-between" align="center" mb="xl" wrap="nowrap">
      <Group gap="md" align="baseline">
        <Title order={1}>{title}</Title>
        <Text ff="monospace" fz="sm" c="dimmed" lts="0.6px">
          {stamp}
        </Text>
      </Group>
      <Group gap="sm" wrap="nowrap">
        {actions}
      </Group>
    </Group>
  )
}

function FunctionsList({
  functions,
  onEdit,
  onNew,
  onToggle,
}: {
  functions: FunctionAutomation[]
  onEdit: (fn: FunctionAutomation) => void
  onNew: () => void
  onToggle: (id: string, enabled: boolean) => void
}) {
  return (
    <Box className={classes.page}>
      <PageHead
        title="Functions"
        stamp="automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile"
        actions={<Button variant="default" onClick={onNew}>+ New function</Button>}
      />

      <Panel
        title="All functions"
        badge={`${functions.length} functions`}
        right={
          <Text ff="monospace" fz="xs" c="dimmed">
            click a function to edit
          </Text>
        }
      >
        <Box style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Text {...headerProps}>Function</Text>
                </Table.Th>
                <Table.Th>
                  <Text {...headerProps}>Trigger</Text>
                </Table.Th>
                <Table.Th>
                  <Text {...headerProps}>Runs as</Text>
                </Table.Th>
                <Table.Th>
                  <Text {...headerProps}>Runs / errors</Text>
                </Table.Th>
                <Table.Th>
                  <Text {...headerProps}>Last run</Text>
                </Table.Th>
                <Table.Th>
                  <Text {...headerProps}>Enabled</Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {functions.map((fn) => (
                <Table.Tr key={fn.id}>
                  <Table.Td w="44%">
                    <Button
                      variant="transparent"
                      color="dark"
                      p={0}
                      h="auto"
                      justify="flex-start"
                      ta="left"
                      onClick={() => onEdit(fn)}
                      aria-label={`Edit ${fn.name}`}
                      styles={{
                        root: {
                          display: 'block',
                          width: '100%',
                          color: 'inherit',
                        },
                        label: {
                          display: 'block',
                          whiteSpace: 'normal',
                        },
                      }}
                    >
                      <Text fw={700} c="dark.9">
                        {fn.name}
                      </Text>
                      <Text c="dimmed" size="sm">
                        {fn.description}
                      </Text>
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <TriggerBadge trigger={fn.trigger} />
                  </Table.Td>
                  <Table.Td>
                    <ProfileBadge profile={fn.profile} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={8}>
                      <Text fw={700}>{fn.runCount}</Text>
                      {fn.errorCount ? (
                        <>
                          <Text c="dimmed">·</Text>
                          <Text c="red.7" ff="monospace">
                            {fn.errorCount} err
                          </Text>
                        </>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" c="dimmed">
                      {fn.runs[0]?.started ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      color="lime"
                      checked={fn.enabled}
                      onChange={(event) =>
                        onToggle(fn.id, event.currentTarget.checked)
                      }
                      aria-label={`${fn.enabled ? 'Disable' : 'Enable'} ${fn.name}`}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
        <Group justify="space-between" px="lg" py="md">
          <Text c="dimmed" ff="monospace">
            1-4 of 4
          </Text>
          <Group gap="sm">
            <Text c="dimmed" ff="monospace" fz="sm">
              rows
            </Text>
            <Select
              data={['6', '12', '24']}
              defaultValue="6"
              w={72}
              size="xs"
              aria-label="Rows per page"
            />
            <Button.Group>
              <Button variant="light" color="gray" disabled>
                «
              </Button>
              <Button variant="light" color="gray" disabled>
                ‹
              </Button>
            </Button.Group>
            <Text>1 / 1</Text>
            <Button.Group>
              <Button variant="light" color="gray" disabled>
                ›
              </Button>
              <Button variant="light" color="gray" disabled>
                »
              </Button>
            </Button.Group>
          </Group>
        </Group>
      </Panel>
    </Box>
  )
}

function TriggerConfig({
  draft,
  setDraft,
}: {
  draft: FunctionAutomation
  setDraft: Dispatch<SetStateAction<FunctionAutomation>>
}) {
  if (draft.trigger === 'scheduled') {
    return (
      <TextInput
        label="Cron expression"
        value={draft.triggerConfig.cron ?? '0 8 * * *'}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            triggerConfig: { cron: event.currentTarget.value },
          }))
        }
        description="min hour dom mon dow · UTC"
      />
    )
  }

  if (draft.trigger === 'manual') {
    const entities = draft.triggerConfig.entities ?? []
    return (
      <Stack gap={6}>
        <Text size="sm" fw={600}>
          Show "Run" on
        </Text>
        {['cases', 'alerts', 'observables', 'tasks'].map((entity) => (
          <Switch
            key={entity}
            label={entity}
            checked={entities.includes(entity)}
            onChange={(event) => {
              const checked = event.currentTarget.checked
              setDraft((current) => {
                const currentEntities = current.triggerConfig.entities ?? []
                return {
                  ...current,
                  triggerConfig: {
                    entities: checked
                      ? [...currentEntities, entity]
                      : currentEntities.filter((item) => item !== entity),
                  },
                }
              })
            }}
          />
        ))}
      </Stack>
    )
  }

  if (draft.trigger === 'api') {
    return (
      <TextInput
        label="Webhook URL"
        value={`https://catlico.origin/api/v1/fn/${draft.id || 'new'}/trigger`}
        readOnly
        description="POST with API key · payload becomes event"
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
      />
    )
  }

  return (
    <TextInput
      label="Fires when"
      value={draft.triggerConfig.condition ?? ''}
      onChange={(event) =>
        setDraft((current) => ({
          ...current,
          triggerConfig: { condition: event.currentTarget.value },
        }))
      }
      description="FilteredEvent predicate"
    />
  )
}

function RunHistory({ runs }: { runs: FunctionRun[] }) {
  return (
    <Panel title="Run history" badge={`${runs.length} recent`}>
      <Box style={{ overflowX: 'auto' }}>
        <Table aria-label="Run history" horizontalSpacing="lg" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {['Status', 'Trigger', 'Started', 'Duration', 'Attempts'].map(
                (label) => (
                  <Table.Th key={label}>
                    <Text {...headerProps}>{label}</Text>
                  </Table.Th>
                ),
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {runs.length ? (
              runs.map((run) => (
                <Table.Tr key={`${run.started}-${run.duration}`}>
                  <Table.Td>
                    <StatusBadge status={run.status} />
                  </Table.Td>
                  <Table.Td>
                    <TriggerBadge trigger={run.trigger} />
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" c="dimmed">
                      {run.started}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" c="dimmed">
                      {run.duration}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={8}>
                      <Text ff="monospace" c="dimmed">
                        {run.attempts}
                      </Text>
                      {run.error ? (
                        <>
                          <Text c="dimmed">·</Text>
                          <Text ff="monospace" c="red.7">
                            {run.error}
                          </Text>
                        </>
                      ) : null}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed">No runs yet.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </Panel>
  )
}

function FunctionEditor({
  draft,
  setDraft,
  consoleText,
  onBack,
  onRun,
  onSave,
}: {
  draft: FunctionAutomation
  setDraft: Dispatch<SetStateAction<FunctionAutomation>>
  consoleText: string
  onBack: () => void
  onRun: () => void
  onSave: () => void
}) {
  const title = draft.id ? 'Edit function' : 'New function'
  const stamp = draft.id
    ? `${draft.runCount} runs · ${draft.errorCount} errors`
    : 'create an automation'

  return (
    <Box className={classes.page} maw={1080} mx="auto">
      <Group gap={8} mb="md">
        <Button variant="transparent" color="gray" p={0} h="auto" onClick={onBack}>
          ← Functions
        </Button>
        <Text c="dimmed">/</Text>
        <Text ff="monospace" fz="xs" c="dimmed">
          {draft.name || 'New'}
        </Text>
      </Group>

      <PageHead
        title={title}
        stamp={stamp}
        actions={
          <>
            <Button variant="default" onClick={onBack}>
              Cancel
            </Button>
            <Button variant="default" leftSection={<Play size={14} />} onClick={onRun}>
              Test run
            </Button>
            <Button color="orange" onClick={onSave}>
              Save function
            </Button>
          </>
        }
      />

      <Box className={classes.functionEditLayout}>
        <Stack gap="md">
          <Panel title="Basics">
            <Box p="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Name"
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.currentTarget.value,
                    }))
                  }
                  placeholder="e.g. Auto-enrich new IP observables"
                />
                <Select
                  label="Runtime"
                  data={['javascript', 'python']}
                  value={draft.runtime}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      runtime: value ?? 'javascript',
                    }))
                  }
                />
              </SimpleGrid>
              <Textarea
                mt="md"
                label="Description"
                value={draft.description}
                minRows={3}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.currentTarget.value,
                  }))
                }
              />
            </Box>
          </Panel>

          <Panel title="Code" badge="ctx SDK in scope">
            <Stack p="lg">
              <Textarea
                aria-label="Function code"
                value={draft.code}
                minRows={14}
                spellCheck={false}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    code: event.currentTarget.value,
                  }))
                }
                styles={{
                  input: {
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 13,
                    lineHeight: 1.45,
                  },
                }}
              />
              <Group gap="sm">
                <Text {...headerProps}>Console</Text>
                <Text ff="monospace" fz="xs" c="dimmed">
                  last test run
                </Text>
              </Group>
              <Paper
                withBorder
                radius="md"
                p="md"
                mih={88}
                bg="gray.0"
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 13,
                }}
              >
                {consoleText || <Text c="dimmed">- not run yet -</Text>}
              </Paper>
            </Stack>
          </Panel>

          <RunHistory runs={draft.runs} />
        </Stack>

        <Stack gap="md">
          <Panel title="Trigger">
            <Stack p="lg">
              <SegmentedControl
                data={[
                  { value: 'scheduled', label: 'SCHEDULED' },
                  { value: 'event', label: 'EVENT' },
                  { value: 'manual', label: 'MANUAL' },
                  { value: 'api', label: 'API' },
                ]}
                value={draft.trigger}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    trigger: value,
                    triggerConfig:
                      value === 'event'
                        ? { condition: current.triggerConfig.condition ?? '' }
                        : value === 'scheduled'
                          ? { cron: current.triggerConfig.cron ?? '0 8 * * *' }
                          : value === 'manual'
                            ? {
                                entities: current.triggerConfig.entities ?? [
                                  'cases',
                                  'observables',
                                ],
                              }
                            : {},
                  }))
                }
                size="xs"
              />
              <TriggerConfig draft={draft} setDraft={setDraft} />
            </Stack>
          </Panel>

          <Panel title="Execution">
            <Stack p="lg">
              <Select
                label="Runs as profile"
                data={profileOptions}
                value={draft.profile}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    profile: value ?? 'analyst',
                  }))
                }
              />
              <TextInput
                label="Timeout (ms)"
                type="number"
                value={String(draft.timeout)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    timeout: Number(event.currentTarget.value) || 15000,
                  }))
                }
              />
              <TextInput
                label="Egress allowlist"
                value={draft.egress}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    egress: event.currentTarget.value,
                  }))
                }
                description="RFC1918 + link-local always blocked"
              />
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box>
                  <Text fw={700} size="sm">
                    Require 4-eyes approval
                  </Text>
                  <Text c="dimmed" size="xs">
                    a second admin must approve before enabling
                  </Text>
                </Box>
                <Switch
                  checked={draft.approval}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      approval: event.currentTarget.checked,
                    }))
                  }
                  aria-label="Require 4-eyes approval"
                />
              </Group>
            </Stack>
          </Panel>

          <Panel title="Secrets" badge="vault refs">
            <Stack p="lg" gap="sm">
              {draft.secrets.length ? (
                draft.secrets.map((secret) => (
                  <Group key={secret} justify="space-between" wrap="nowrap">
                    <Code>{secret}</Code>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      aria-label={`Remove ${secret}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          secrets: current.secrets.filter((item) => item !== secret),
                        }))
                      }
                    >
                      <X size={16} />
                    </ActionIcon>
                  </Group>
                ))
              ) : (
                <Text c="dimmed" size="sm">
                  No secrets referenced.
                </Text>
              )}
              <Divider />
              <Button
                variant="default"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    secrets: [...current.secrets, `SECRET_${current.secrets.length + 1}`],
                  }))
                }
              >
                + Add secret ref
              </Button>
            </Stack>
          </Panel>
        </Stack>
      </Box>
    </Box>
  )
}

export function FunctionsPage() {
  const [functions, setFunctions] = useState(initialFunctions)
  const [draft, setDraft] = useState<FunctionAutomation | null>(null)
  const [consoleText, setConsoleText] = useState('')

  const enabledCount = useMemo(
    () => functions.filter((fn) => fn.enabled).length,
    [functions],
  )

  const editFunction = (fn: FunctionAutomation) => {
    setDraft(cloneFunction(fn))
    setConsoleText('')
  }

  const saveFunction = () => {
    if (!draft) return
    const cleanName = draft.name.trim()
    if (!cleanName) {
      notifications.show({ color: 'red', message: 'Function name is required' })
      return
    }

    const saved = {
      ...draft,
      id: draft.id || `fn-${Date.now().toString(36)}`,
      name: cleanName,
      description: draft.description.trim(),
    }
    setFunctions((current) => {
      const existing = current.findIndex((fn) => fn.id === saved.id)
      if (existing === -1) return [...current, saved]
      return current.map((fn) => (fn.id === saved.id ? saved : fn))
    })
    notifications.show({ color: 'green', message: 'Function saved' })
    setDraft(null)
  }

  const runFunction = () => {
    if (!draft) return
    const output = `[run] starting function as profile "${draft.profile}"...
[ctx] event = {caseId:"#1842", observable:{dataType:"ip", data:"203.0.113.47"}}
[ctx.analyzers.run] AbuseIPDB -> verdict=malicious (97%)
[ctx.case.addTag] #1842 += "auto:malicious-ip"
[ctx.notify.slack] #soc-alerts <- "Malicious IP 203.0.113.47 auto-tagged on #1842"
[done] handler resolved in 0.94s`

    setConsoleText(output)
    setDraft((current) =>
      current
        ? {
            ...current,
            runs: [
              {
                status: 'success',
                trigger: current.trigger,
                started: 'just now',
                duration: '0.9s',
                attempts: 1,
              },
              ...current.runs,
            ],
          }
        : current,
    )
    notifications.show({ color: 'green', message: 'Test run completed' })
  }

  if (draft) {
    return (
      <FunctionEditor
        draft={draft}
        setDraft={setDraft}
        consoleText={consoleText}
        onBack={() => setDraft(null)}
        onRun={runFunction}
        onSave={saveFunction}
      />
    )
  }

  return (
    <FunctionsList
      functions={functions}
      onEdit={editFunction}
      onNew={() => {
        setDraft(newFunction())
        setConsoleText('')
      }}
      onToggle={(id, enabled) => {
        setFunctions((current) =>
          current.map((fn) => (fn.id === id ? { ...fn, enabled } : fn)),
        )
        notifications.show({
          message: `${enabled ? 'Enabled' : 'Disabled'} function (${enabledCount})`,
        })
      }}
    />
  )
}
