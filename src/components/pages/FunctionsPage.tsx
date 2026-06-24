import classes from '#/components/Cases/CasesPage.module.css'
import {
  functionKeys,
  functionsQueryOptions,
  createFunction,
  updateFunction,
  deleteFunction,
  type FunctionPublic,
} from '#/components/Functions/functionsQueries'
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

type FunctionTrigger = 'scheduled' | 'event' | 'manual' | 'api'
type FunctionRuntime = 'javascript' | 'python'

type FunctionAutomation = {
  id: number
  name: string
  description: string
  runtime: FunctionRuntime
  trigger: FunctionTrigger
  triggerConfig: Record<string, unknown>
  profile: string
  enabled: boolean
  timeout: number
  egress: string
  approval: boolean
  code: string
  secrets: string[]
  runCount: number
  errorCount: number
  runs: { status: string; trigger: string; started: string; duration: string; attempts: number; error?: string }[]
}

type DraftUpdater = (
  update: (current: FunctionAutomation) => FunctionAutomation,
) => void

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

function fromApi(f: FunctionPublic): FunctionAutomation {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    runtime: f.runtime,
    trigger: f.trigger,
    triggerConfig: f.trigger_config,
    profile: f.profile,
    enabled: f.enabled,
    timeout: f.timeout_ms,
    egress: f.egress,
    approval: f.approval,
    code: f.code,
    secrets: f.secrets,
    runCount: f.run_count,
    errorCount: f.error_count,
    runs: (f.runs ?? []).map((r) => ({
      status: r.status,
      trigger: r.trigger,
      started: new Date(r.started_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
      duration: `${(r.duration_ms / 1000).toFixed(1)}s`,
      attempts: r.attempts,
      error: r.error ?? undefined,
    })),
  }
}

const headerProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 11,
  fw: 600,
  c: 'dimmed',
  lts: '1px',
} as const

const profileOptions = ['analyst', 'read-only', 'senior-analyst', 'org-admin']

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
    <Badge variant="light" color={color} radius="sm" size="sm" ff="monospace" tt="lowercase">
      {trigger}
    </Badge>
  )
}

function ProfileBadge({ profile }: { profile: string }) {
  const color = profile === 'read-only' ? 'gray' : 'blue'
  return (
    <Badge variant="light" color={color} radius="xl" size="md" ff="monospace" tt="lowercase"
      w={170} styles={{ label: { textTransform: 'none' } }}>
      {profile}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="light" color={status === 'success' ? 'lime' : 'red'} radius="sm" size="sm" ff="monospace" tt="lowercase">
      {status}
    </Badge>
  )
}

function FuncPanel({ title, badge, right, children }: { title: string; badge?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" shadow="sm" bg="body" style={{ overflow: 'hidden' }}>
      <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid var(--line-soft)' }}>
        <Group gap="sm">
          <Title order={2} size="h4">{title}</Title>
          {badge ? <Badge variant="default" color="gray" radius="xl" ff="monospace">{badge}</Badge> : null}
        </Group>
        {right}
      </Group>
      {children}
    </Paper>
  )
}

function PageHead({ title, stamp, actions }: { title: string; stamp: string; actions: ReactNode }) {
  return (
    <Group justify="space-between" align="center" mb="xl" wrap="nowrap">
      <Group gap="md" align="baseline">
        <Title order={1}>{title}</Title>
        <Text ff="monospace" fz="sm" c="dimmed" lts="0.6px">{stamp}</Text>
      </Group>
      <Group gap="sm" wrap="nowrap">{actions}</Group>
    </Group>
  )
}

function FunctionsList({
  functions,
  onEdit,
  onNew,
  onToggle,
  loading,
}: {
  functions: FunctionAutomation[]
  onEdit: (fn: FunctionAutomation) => void
  onNew: () => void
  onToggle: (id: number, enabled: boolean) => void
  loading: boolean
}) {
  return (
    <Box className={classes.page}>
      <PageHead
        title="Functions"
        stamp="automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile"
        actions={
          <Button variant="default" onClick={onNew}>
            + New function
          </Button>
        }
      />

      <FuncPanel title="All functions" badge={`${functions.length} functions`}
        right={<Text ff="monospace" fz="xs" c="dimmed">click a function to edit</Text>}>
        <Box style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th><Text {...headerProps}>Function</Text></Table.Th>
                <Table.Th><Text {...headerProps}>Trigger</Text></Table.Th>
                <Table.Th><Text {...headerProps}>Runs as</Text></Table.Th>
                <Table.Th><Text {...headerProps}>Runs / errors</Text></Table.Th>
                <Table.Th><Text {...headerProps}>Last run</Text></Table.Th>
                <Table.Th><Text {...headerProps}>Enabled</Text></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" c="dimmed" py={40}>
                    Loading functions...
                  </Table.Td>
                </Table.Tr>
              ) : functions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" c="dimmed" py={40}>
                    No functions yet. Create one to get started.
                  </Table.Td>
                </Table.Tr>
              ) : (
                functions.map((fn) => (
                  <Table.Tr key={fn.id}>
                    <Table.Td w="44%">
                      <Button variant="transparent" color="dark" p={0} h="auto" justify="flex-start" ta="left"
                        onClick={() => onEdit(fn)} aria-label={`Edit ${fn.name}`}
                        styles={{ root: { display: 'block', width: '100%', color: 'inherit' }, label: { display: 'block', whiteSpace: 'normal' } }}>
                        <Text fw={700} c="dark.9">{fn.name}</Text>
                        <Text c="dimmed" size="sm">{fn.description}</Text>
                      </Button>
                    </Table.Td>
                    <Table.Td><TriggerBadge trigger={fn.trigger} /></Table.Td>
                    <Table.Td><ProfileBadge profile={fn.profile} /></Table.Td>
                    <Table.Td>
                      <Group gap={8}>
                        <Text fw={700}>{fn.runCount}</Text>
                        {fn.errorCount ? <><Text c="dimmed">·</Text><Text c="red.7" ff="monospace">{fn.errorCount} err</Text></> : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" c="dimmed">{fn.runs[0]?.started ?? '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Switch color="lime" checked={fn.enabled}
                        onChange={(event) => onToggle(fn.id, event.currentTarget.checked)}
                        aria-label={`${fn.enabled ? 'Disable' : 'Enable'} ${fn.name}`} />
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
        <Group justify="space-between" px="lg" py="md">
          <Text c="dimmed" ff="monospace">1-{Math.min(functions.length, 4)} of {functions.length}</Text>
        </Group>
      </FuncPanel>
    </Box>
  )
}

function TriggerConfig({ draft, setDraft }: { draft: FunctionAutomation; setDraft: DraftUpdater }) {
  if (draft.trigger === 'scheduled') {
    return (
      <TextInput label="Cron expression"
        value={String(draft.triggerConfig.cron ?? '0 8 * * *')}
        onChange={(event) => setDraft((current) => ({ ...current, triggerConfig: { cron: event.currentTarget.value } }))}
        description="min hour dom mon dow · UTC" />
    )
  }
  if (draft.trigger === 'manual') {
    const entities = (draft.triggerConfig.entities as string[]) ?? []
    return (
      <Stack gap={6}>
        <Text size="sm" fw={600}>Show "Run" on</Text>
        {['cases', 'alerts', 'observables', 'tasks'].map((entity) => (
          <Switch key={entity} label={entity} checked={entities.includes(entity)}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                triggerConfig: { entities: event.currentTarget.checked ? [...entities, entity] : entities.filter((e) => e !== entity) },
              }))
            }} />
        ))}
      </Stack>
    )
  }
  if (draft.trigger === 'api') {
    return (
      <TextInput label="Webhook URL"
        value={`https://catlico.origin/api/v1/fn/${draft.id || 'new'}/trigger`}
        readOnly description="POST with API key · payload becomes event"
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }} />
    )
  }
  return (
    <TextInput label="Fires when"
      value={String(draft.triggerConfig.condition ?? '')}
      onChange={(event) => setDraft((current) => ({ ...current, triggerConfig: { condition: event.currentTarget.value } }))}
      description="FilteredEvent predicate" />
  )
}

function RunHistory({ runs }: { runs: FunctionAutomation['runs'] }) {
  return (
    <FuncPanel title="Run history" badge={`${runs.length} recent`}>
      <Box style={{ overflowX: 'auto' }}>
        <Table aria-label="Run history" horizontalSpacing="lg" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              {['Status', 'Trigger', 'Started', 'Duration', 'Attempts'].map((label) => (
                <Table.Th key={label}><Text {...headerProps}>{label}</Text></Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {runs.length ? runs.map((run) => (
              <Table.Tr key={`${run.started}-${run.duration}`}>
                <Table.Td><StatusBadge status={run.status} /></Table.Td>
                <Table.Td><TriggerBadge trigger={run.trigger as FunctionTrigger} /></Table.Td>
                <Table.Td><Text ff="monospace" c="dimmed">{run.started}</Text></Table.Td>
                <Table.Td><Text ff="monospace" c="dimmed">{run.duration}</Text></Table.Td>
                <Table.Td>
                  <Group gap={8}>
                    <Text ff="monospace" c="dimmed">{run.attempts}</Text>
                    {run.error ? <><Text c="dimmed">·</Text><Text ff="monospace" c="red.7">{run.error}</Text></> : null}
                  </Group>
                </Table.Td>
              </Table.Tr>
            )) : (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed">No runs yet.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </FuncPanel>
  )
}

function FunctionEditor({
  draft,
  setDraft,
  onBack,
  onSave,
  saving,
}: {
  draft: FunctionAutomation
  setDraft: DraftUpdater
  onBack: () => void
  onSave: () => void
  saving: boolean
}) {
  const title = draft.id ? 'Edit function' : 'New function'
  const stamp = draft.id ? `${draft.runCount} runs · ${draft.errorCount} errors` : 'create an automation'

  return (
    <Box className={classes.page} maw={1080} mx="auto">
      <Group gap={8} mb="md">
        <Button variant="transparent" color="gray" p={0} h="auto" onClick={onBack}>← Functions</Button>
        <Text c="dimmed">/</Text>
        <Text ff="monospace" fz="xs" c="dimmed">{draft.name || 'New'}</Text>
      </Group>

      <PageHead title={title} stamp={stamp} actions={
        <>
          <Button variant="default" onClick={onBack}>Cancel</Button>
          <Button color="orange" loading={saving} onClick={onSave}>Save function</Button>
        </>
      } />

      <Box className={classes.functionEditLayout}>
        <Stack gap="md">
          <FuncPanel title="Basics">
            <Box p="lg">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Name" required value={draft.name}
                  onChange={(event) => setDraft((c) => ({ ...c, name: event.currentTarget.value }))}
                  placeholder="e.g. Auto-enrich new IP observables" />
                <Select label="Runtime" data={['javascript', 'python']} value={draft.runtime}
                  onChange={(value) => setDraft((c) => ({ ...c, runtime: (value ?? 'javascript') as FunctionRuntime }))} />
              </SimpleGrid>
              <Textarea mt="md" label="Description" value={draft.description} minRows={3}
                onChange={(event) => setDraft((c) => ({ ...c, description: event.currentTarget.value }))} />
            </Box>
          </FuncPanel>

          <FuncPanel title="Code" badge="ctx SDK in scope">
            <Stack p="lg">
              <Textarea aria-label="Function code" value={draft.code} minRows={14} spellCheck={false}
                onChange={(event) => setDraft((c) => ({ ...c, code: event.currentTarget.value }))}
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13, lineHeight: 1.45 } }} />
              <Paper withBorder radius="md" p="md" mih={88} bg="gray.0"
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13 }}>
                <Text c="dimmed">Test-run sandbox is not available yet. Functions must be triggered from their configured source.</Text>
              </Paper>
            </Stack>
          </FuncPanel>

          <RunHistory runs={draft.runs} />
        </Stack>

        <Stack gap="md">
          <FuncPanel title="Trigger">
            <Stack p="lg">
              <SegmentedControl
                data={[
                  { value: 'scheduled', label: 'SCHEDULED' },
                  { value: 'event', label: 'EVENT' },
                  { value: 'manual', label: 'MANUAL' },
                  { value: 'api', label: 'API' },
                ]}
                value={draft.trigger}
                onChange={(value) => setDraft((current) => ({
                  ...current, trigger: value as FunctionTrigger, triggerConfig:
                    value === 'event' ? { condition: current.triggerConfig.condition ?? '' }
                    : value === 'scheduled' ? { cron: current.triggerConfig.cron ?? '0 8 * * *' }
                    : value === 'manual' ? { entities: (current.triggerConfig.entities as string[]) ?? ['cases', 'observables'] }
                    : {},
                }))}
                size="xs" />
              <TriggerConfig draft={draft} setDraft={setDraft} />
            </Stack>
          </FuncPanel>

          <FuncPanel title="Execution">
            <Stack p="lg">
              <Select label="Runs as profile" data={profileOptions} value={draft.profile}
                onChange={(value) => setDraft((c) => ({ ...c, profile: value ?? 'analyst' }))} />
              <TextInput label="Timeout (ms)" type="number" value={String(draft.timeout)}
                onChange={(event) => setDraft((c) => ({ ...c, timeout: Number(event.currentTarget.value) || 15000 }))} />
              <TextInput label="Egress allowlist" value={draft.egress}
                onChange={(event) => setDraft((c) => ({ ...c, egress: event.currentTarget.value }))}
                description="RFC1918 + link-local always blocked" />
              <Group justify="space-between" align="center" wrap="nowrap">
                <Box>
                  <Text fw={700} size="sm">Require 4-eyes approval</Text>
                  <Text c="dimmed" size="xs">a second admin must approve before enabling</Text>
                </Box>
                <Switch checked={draft.approval}
                  onChange={(event) => setDraft((c) => ({ ...c, approval: event.currentTarget.checked }))}
                  aria-label="Require 4-eyes approval" />
              </Group>
            </Stack>
          </FuncPanel>

          <FuncPanel title="Secrets" badge="vault refs">
            <Stack p="lg" gap="sm">
              {draft.secrets.length ? draft.secrets.map((secret) => (
                <Group key={secret} justify="space-between" wrap="nowrap">
                  <Code>{secret}</Code>
                  <ActionIcon variant="light" color="gray" aria-label={`Remove ${secret}`}
                    onClick={() => setDraft((c) => ({ ...c, secrets: c.secrets.filter((s) => s !== secret) }))}>
                    <X size={16} />
                  </ActionIcon>
                </Group>
              )) : <Text c="dimmed" size="sm">No secrets referenced.</Text>}
              <Divider />
              <Button variant="default" onClick={() => setDraft((c) => ({ ...c, secrets: [...c.secrets, `SECRET_${c.secrets.length + 1}`] }))}>
                + Add secret ref
              </Button>
            </Stack>
          </FuncPanel>
        </Stack>
      </Box>
    </Box>
  )
}

function newFunctionAutomation(): FunctionAutomation {
  return {
    id: 0,
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

export function FunctionsPage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(functionsQueryOptions())
  const [draft, setDraft] = useState<FunctionAutomation | null>(null)
  const funcs = (data?.items ?? []).map(fromApi)

  const saveMutation = useMutation({
    mutationFn: (fn: FunctionAutomation) =>
      fn.id
        ? updateFunction(fn.id, {
            name: fn.name,
            description: fn.description,
            runtime: fn.runtime,
            trigger: fn.trigger,
            trigger_config: fn.triggerConfig,
            profile: fn.profile,
            enabled: fn.enabled,
            timeout_ms: fn.timeout,
            egress: fn.egress,
            approval: fn.approval,
            code: fn.code,
            secrets: fn.secrets,
          })
        : createFunction({
            name: fn.name,
            description: fn.description,
            runtime: fn.runtime,
            trigger: fn.trigger,
            trigger_config: fn.triggerConfig,
            profile: fn.profile,
            enabled: fn.enabled,
            timeout_ms: fn.timeout,
            egress: fn.egress,
            approval: fn.approval,
            code: fn.code,
            secrets: fn.secrets,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: functionKeys.all })
      notifications.show({ color: 'green', message: 'Function saved' })
      setDraft(null)
    },
    onError: (error) =>
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : 'Failed to save function' }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateFunction(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: functionKeys.all }),
    onError: (error) =>
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : 'Failed to toggle function' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFunction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: functionKeys.all })
      notifications.show({ message: 'Function deleted' })
      setDraft(null)
    },
  })

  if (draft) {
    return (
      <FunctionEditor
        draft={draft}
        setDraft={(update) => setDraft((c) => (c ? update(c) : c))}
        onBack={() => setDraft(null)}
        onSave={() => {
          if (!draft.name.trim()) {
            notifications.show({ color: 'red', message: 'Function name is required' })
            return
          }
          saveMutation.mutate({ ...draft, name: draft.name.trim(), description: draft.description.trim() })
        }}
        saving={saveMutation.isPending}
      />
    )
  }

  if (isError) {
    return (
      <Box className={classes.page}>
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load functions.</Text>
          <Button variant="default" loading={isFetching} onClick={() => refetch()}>Retry</Button>
        </Stack>
      </Box>
    )
  }

  return (
    <FunctionsList
      functions={funcs}
      onEdit={(fn) => setDraft({ ...fn })}
      onNew={() => setDraft(newFunctionAutomation())}
      onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
      loading={isPending}
    />
  )
}
