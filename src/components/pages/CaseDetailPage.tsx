import type {
  CaseDetail,
  CaseDetailAlert,
  CaseDetailAttachment,
  CaseDetailComment,
  CaseDetailObservable,
  CaseDetailTask,
  CaseDetailTimelineEvent,
} from '#/components/Cases/caseDetailsData'
import type { ReactNode } from 'react'
import { avatarFor, SEV } from '#/components/Cases/casesData'
import { getCaseDetail, trafficLabel } from '#/components/Cases/caseDetailsData'
import classes from '#/components/Cases/CasesPage.module.css'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Divider,
  Drawer,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  VisuallyHidden,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from '@tanstack/react-router'
import {
  Clock3,
  Download,
  Flag,
  Hourglass,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

export const CASE_TABS = [
  'details',
  'tasks',
  'observables',
  'comments',
  'attachments',
  'timeline',
  'sharing',
] as const
export type CaseTab = (typeof CASE_TABS)[number]

export const Route = createFileRoute('/_app/cases/$caseId')({
  component: CaseDetailPage,
})

const fieldLabelProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  lts: '1px',
  c: 'dimmed',
} as const

const actionNotice = (message: string) =>
  notifications.show({ color: 'orange', message })

function CaseDetailPage() {
  const { caseId } = Route.useParams()
  const caseDetail = getCaseDetail(caseId)

  return (
    <Box className={classes.page}>
      <Group gap={8} mb={16}>
        <Text
          component={Link}
          to="/cases"
          ff="monospace"
          fz={12}
          c="dimmed"
          td="none"
        >
          &larr; Cases
        </Text>
        <Text ff="monospace" fz={12} c="dimmed">
          /
        </Text>
        <Text ff="monospace" fz={12} c="dimmed">
          {caseDetail.id}
        </Text>
      </Group>

      <CaseSummaryCard caseDetail={caseDetail} />

      <Box className={classes.caseDetailLayout} mt="md">
        <CaseBody caseDetail={caseDetail} />
        <CaseSideRail caseDetail={caseDetail} />
      </Box>
    </Box>
  )
}

function CaseSummaryCard({ caseDetail }: { caseDetail: CaseDetail }) {
  const [initials, color] = avatarFor(caseDetail.assignee)

  return (
    <Paper
      radius="md"
      p="lg"
      withBorder
      style={{
        borderLeft:
          '5px solid light-dark(var(--mantine-color-orange-7), var(--mantine-color-orange-5))',
      }}
    >
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Box flex={1} miw={0}>
          <Group gap={12} mb={8} wrap="wrap">
            <Text {...fieldLabelProps}>Case {caseDetail.id}</Text>
            <Text
              ff="monospace"
              fz={11}
              fw={700}
              c={`var(--sev-${SEV[caseDetail.sev]})`}
            >
              {SEV[caseDetail.sev].toUpperCase()}
            </Text>
            <StatusBadge
              status={caseDetail.status}
              label={caseDetail.statusName}
            />
          </Group>

          <Title order={1} size="h2" maw={860} mb={14}>
            {caseDetail.title}
          </Title>

          <Group gap={8} mb="md" wrap="wrap">
            <TrafficBadge label="TLP" value={caseDetail.tlp} />
            <TrafficBadge label="PAP" value={caseDetail.pap} />
            {caseDetail.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
            <Badge
              variant="light"
              color="orange"
              radius="sm"
              leftSection={<Clock3 size={12} />}
            >
              {caseDetail.sla}
            </Badge>
          </Group>
        </Box>

        <Group gap="sm" visibleFrom="md" wrap="nowrap">
          <Button
            variant="default"
            leftSection={<UserPlus size={16} />}
            onClick={() => actionNotice('Assignee menu opened')}
          >
            Assign
          </Button>
          <Button
            variant="default"
            leftSection={<Download size={16} />}
            onClick={() => actionNotice('Report export queued')}
          >
            Export report
          </Button>
          <Button
            variant="default"
            leftSection={<XCircle size={16} />}
            onClick={() => actionNotice('Close case workflow opened')}
          >
            Close case
          </Button>
          <Button
            color="orange"
            leftSection={<Play size={16} />}
            onClick={() => actionNotice('Analyzer run queued')}
          >
            Run analyzers
          </Button>
        </Group>
      </Group>

      <Divider my="md" />

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 6 }} spacing="md">
        <SummaryField label="Assignee">
          <Group gap={8} wrap="nowrap">
            <Avatar size={28} radius="xl" color="orange" bg={color}>
              {initials}
            </Avatar>
            <Text fw={700}>{caseDetail.assignee}</Text>
          </Group>
        </SummaryField>
        <SummaryField label="Opened">{caseDetail.opened}</SummaryField>
        <SummaryField label="Source">{caseDetail.source}</SummaryField>
        <SummaryField label="Business unit">
          {caseDetail.businessUnit}
        </SummaryField>
        <SummaryField label="Tasks">
          {caseDetail.tasksDone} / {caseDetail.tasksTotal} done
        </SummaryField>
        <SummaryField label="Observables">
          {caseDetail.observables.length} &middot;{' '}
          {caseDetail.observables.filter((observable) => observable.ioc).length}{' '}
          IOC
        </SummaryField>
      </SimpleGrid>

      <Group gap="sm" hiddenFrom="md" mt="lg">
        <Button variant="default" leftSection={<UserPlus size={16} />}>
          Assign
        </Button>
        <Button color="orange" leftSection={<Play size={16} />}>
          Run analyzers
        </Button>
      </Group>
    </Paper>
  )
}

function SummaryField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Box>
      <Text {...fieldLabelProps} mb={4}>
        {label}
      </Text>
      <Text fw={650}>{children}</Text>
    </Box>
  )
}

function TrafficBadge({
  label,
  value,
}: {
  label: 'TLP' | 'PAP'
  value: 0 | 1 | 2 | 3
}) {
  return (
    <Badge
      radius="sm"
      variant="light"
      color={value === 2 ? 'yellow' : value === 1 ? 'green' : 'gray'}
      tt="uppercase"
      ff="monospace"
    >
      {label}: {trafficLabel(value)}
    </Badge>
  )
}

function CaseBody({ caseDetail }: { caseDetail: CaseDetail }) {
  const { caseId } = Route.useParams()
  const lastSegment = useLocation({
    select: (location) => location.pathname.split('/').filter(Boolean).pop(),
  })
  const activeTab: CaseTab = CASE_TABS.includes(lastSegment as CaseTab)
    ? (lastSegment as CaseTab)
    : 'details'

  const tabDefs: { value: CaseTab; label: string }[] = [
    { value: 'details', label: 'Details' },
    { value: 'tasks', label: `Tasks ${caseDetail.tasks.length}` },
    {
      value: 'observables',
      label: `Observables ${caseDetail.observables.length}`,
    },
    { value: 'comments', label: `Comments ${caseDetail.comments.length}` },
    {
      value: 'attachments',
      label: `Attachments ${caseDetail.attachments.length}`,
    },
    { value: 'timeline', label: 'Timeline' },
    { value: 'sharing', label: `Sharing ${caseDetail.shares}` },
  ]

  return (
    <Paper radius="md" withBorder>
      <Tabs value={activeTab}>
        <Tabs.List px="md">
          {tabDefs.map(({ value, label }) => (
            <Tabs.Tab
              key={value}
              value={value}
              renderRoot={(props) => (
                <Link
                  to="/cases/$caseId/$tab"
                  params={{ caseId, tab: value }}
                  {...props}
                />
              )}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Outlet />
    </Paper>
  )
}

/** Renders the panel for the active case tab (driven by the URL segment). */
export function CaseTabPanel({
  tab,
  caseDetail,
}: {
  tab: CaseTab
  caseDetail: CaseDetail
}) {
  switch (tab) {
    case 'tasks':
      return <TasksPanel caseDetail={caseDetail} />
    case 'observables':
      return <ObservablesPanel caseDetail={caseDetail} />
    case 'comments':
      return <CommentsPanel comments={caseDetail.comments} />
    case 'attachments':
      return <AttachmentsPanel attachments={caseDetail.attachments} />
    case 'timeline':
      return <TimelinePanel timeline={caseDetail.timeline} />
    case 'sharing':
      return (
        <EmptyTab
          icon={<ShieldCheck size={18} />}
          label={`${caseDetail.shares} external sharing entries are active.`}
        />
      )
    case 'details':
    default:
      return <DetailsPanel caseDetail={caseDetail} />
  }
}

function DetailsPanel({ caseDetail }: { caseDetail: CaseDetail }) {
  return (
    <Stack gap="lg" p="lg">
      <Stack gap="sm" maw={850}>
        {caseDetail.description.map((paragraph, index) => (
          <Text key={paragraph} fz={15} lh={1.45} c="var(--desc)">
            {index === caseDetail.description.length - 1 ? (
              <>
                <Text component="span" fw={700}>
                  Working hypothesis:
                </Text>{' '}
                {paragraph.replace('Working hypothesis: ', '')}
              </>
            ) : (
              <HighlightedDescription text={paragraph} />
            )}
          </Text>
        ))}
      </Stack>

      <Box>
        <Text {...fieldLabelProps} mb="sm">
          Custom fields
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" maw={900}>
          {caseDetail.customFields.map(([label, value]) => (
            <Box key={label}>
              <Text {...fieldLabelProps} mb={4}>
                {label}
                {label === 'Data classification' ? (
                  <Text component="span" c="red">
                    {' '}
                    *
                  </Text>
                ) : null}
              </Text>
              <Paper bg="gray.0" withBorder radius="sm" px="sm" py={8}>
                <Text>{value}</Text>
              </Paper>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Box>
        <Text {...fieldLabelProps} mb="sm">
          Linked alerts
        </Text>
        <Stack gap={0}>
          {caseDetail.linkedAlerts.map((alert) => (
            <LinkedAlertRow key={alert.id} alert={alert} />
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

function HighlightedDescription({ text }: { text: string }) {
  const parts = [
    'AL-9119',
    'app id 7f3c…91ab',
    'Mail.ReadWrite',
    'offline_access',
    'AL-9102',
    'svc-finops@origin…',
  ]
  const escaped = parts.map((part) =>
    part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  const regex = new RegExp(`(${escaped.join('|')})`, 'g')

  return (
    <>
      {text
        .split(regex)
        .map((part, index) =>
          parts.includes(part) ? (
            <Code key={`${part}-${index}`}>{part}</Code>
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          ),
        )}
    </>
  )
}

function LinkedAlertRow({ alert }: { alert: CaseDetailAlert }) {
  return (
    <Group
      gap="sm"
      wrap="nowrap"
      py={10}
      style={{ borderBottom: '1px solid var(--line-soft)' }}
    >
      <Text ff="monospace" fz={13} c="dimmed" w={64}>
        {alert.id}
      </Text>
      <Box
        w={4}
        h={22}
        bg={`var(--sev-${SEV[alert.sev]})`}
        style={{ borderRadius: 3, flexShrink: 0 }}
      />
      <Text fw={600} truncate>
        {alert.title}
      </Text>
      <TrafficBadge label="TLP" value={alert.tlp} />
    </Group>
  )
}

const TASK_STATUS: Record<
  CaseDetailTask['status'],
  { color: string; label: string }
> = {
  completed: { color: 'green', label: 'Completed' },
  inprogress: { color: 'yellow', label: 'In progress' },
  waiting: { color: 'gray', label: 'Waiting' },
  cancel: { color: 'gray', label: 'Cancelled' },
}

// "2026-06-12T10:00" → "Fri 10:00 am" — the relative weekday + time shown
// on each task's due badge.
function formatDue(due: string) {
  const date = new Date(due)
  const day = date.toLocaleDateString('en-US', { weekday: 'short' })
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
  return `${day} ${time}`
}

function taskMeta(task: CaseDetailTask) {
  return [
    task.group,
    task.assignee === 'Unassigned' ? null : task.assignee,
    task.logs > 0 ? `${task.logs} log${task.logs === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const TASK_EDGE_COLOR: Record<CaseDetailTask['status'], string> = {
  waiting: 'var(--mantine-color-gray-6)',
  inprogress: 'var(--mantine-color-yellow-6)',
  completed: 'var(--mantine-color-green-6)',
  cancel: 'var(--mantine-color-gray-5)',
}

const TEAM_OPTIONS = [
  'Unassigned',
  'J. Tanaka',
  'P. Nguyen',
  'A. Whitford',
  'S. Iyer',
]

function TasksPanel({ caseDetail }: { caseDetail: CaseDetail }) {
  const [activeTask, setActiveTask] = useState<CaseDetailTask | null>(null)
  const tasks = caseDetail.tasks

  return (
    <Stack gap={0} p="lg">
      <TaskDetailDrawer
        task={activeTask}
        caseDetail={caseDetail}
        onClose={() => setActiveTask(null)}
      />
      {tasks.map((task) => {
        const done = task.status === 'completed'
        return (
          <Group
            key={task.id}
            gap="sm"
            wrap="nowrap"
            py={10}
            tabIndex={0}
            onClick={() => setActiveTask(task)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setActiveTask(task)
            }}
            style={{ borderBottom: '1px solid var(--line-soft)' }}
          >
            <Checkbox
              radius="sm"
              size="sm"
              color="green"
              defaultChecked={done}
              aria-label={`Mark ${task.title} complete`}
              onClick={(event) => event.stopPropagation()}
            />
            <Box miw={0} flex={1}>
              <Group gap={6} wrap="nowrap" miw={0}>
                <Text
                  fw={650}
                  truncate
                  td={done ? 'line-through' : undefined}
                  c={done ? 'dimmed' : undefined}
                >
                  {task.title}
                </Text>
                {task.flagged ? (
                  <Flag
                    size={13}
                    color="var(--sev-high)"
                    fill="var(--sev-high)"
                    style={{ flexShrink: 0 }}
                  />
                ) : null}
                <Text
                  ff="monospace"
                  fz={11}
                  c="dimmed"
                  style={{ flexShrink: 0 }}
                >
                  {taskMeta(task)}
                </Text>
              </Group>
            </Box>
            {task.due ? <DueBadge due={task.due} done={done} /> : null}
            <Badge
              variant="light"
              radius="sm"
              size="sm"
              tt="uppercase"
              fw={700}
              color={TASK_STATUS[task.status].color}
            >
              {TASK_STATUS[task.status].label}
            </Badge>
          </Group>
        )
      })}

      <Group gap="sm" wrap="nowrap" pt="md">
        <TextInput
          flex={1}
          placeholder="Add a task… e.g. Revoke refresh tokens for affected users"
        />
        <Button variant="default" onClick={() => actionNotice('Task added')}>
          Add
        </Button>
      </Group>
    </Stack>
  )
}

function TaskDetailDrawer({
  task,
  caseDetail,
  onClose,
}: {
  task: CaseDetailTask | null
  caseDetail: CaseDetail
  onClose: () => void
}) {
  if (!task) return null

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="min(560px, 94vw)"
      padding={0}
      title={<VisuallyHidden>Task detail</VisuallyHidden>}
      aria-label="Task detail"
      closeButtonProps={{ 'aria-label': 'Close task detail' }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      styles={{
        content: { borderLeft: '1px solid var(--line-soft)' },
        header: {
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--line-soft)',
          padding: '18px 22px 0',
        },
        body: { padding: 0 },
      }}
    >
      <Box
        style={{
          borderLeft: `4px solid ${TASK_EDGE_COLOR[task.status]}`,
          marginTop: -44,
          paddingTop: 44,
        }}
      >
        <Box px={22} pb={16}>
          <Text ff="monospace" fz={12} c="dimmed" mb={8}>
            {caseDetail.id} · task {task.id}
          </Text>
          <TextInput
            value={task.title}
            readOnly
            rightSection={
              task.flagged ? (
                <Flag
                  size={16}
                  color="var(--sev-high)"
                  fill="var(--sev-high)"
                />
              ) : null
            }
            styles={{ input: { fontWeight: 700, fontSize: 18 } }}
          />
        </Box>

        <CaseDrawerSection title="Status">
          <Group gap={8} wrap="wrap">
            {(
              [
                ['waiting', 'Waiting'],
                ['inprogress', 'In progress'],
                ['completed', 'Completed'],
                ['cancel', 'Cancelled'],
              ] as const
            ).map(([status, label]) => (
              <Button
                key={status}
                size="xs"
                variant={task.status === status ? 'light' : 'default'}
                color={TASK_STATUS[status].color}
                tt="uppercase"
                ff="monospace"
                onClick={() => actionNotice(`Task status set to ${label}`)}
              >
                {label}
              </Button>
            ))}
          </Group>
          <Group gap={8} mt={12} wrap="wrap">
            <Text ff="monospace" fz={12} c="dimmed">
              start {task.start ? formatTaskDateTime(task.start) : '—'}
            </Text>
            <Text ff="monospace" fz={12} c="dimmed">
              end {task.end ? formatTaskDateTime(task.end) : '—'}
            </Text>
            <Text ff="monospace" fz={12} c="red">
              {task.due && task.status !== 'completed'
                ? isTaskOverdue(task)
                  ? 'overdue'
                  : ''
                : ''}
            </Text>
          </Group>
        </CaseDrawerSection>

        <CaseDrawerSection title="Details">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Box>
              <Text {...fieldLabelProps} mb={6}>
                Group
              </Text>
              <TextInput value={task.group} readOnly />
            </Box>
            <Box>
              <Text {...fieldLabelProps} mb={6}>
                Assignee
              </Text>
              <Select
                data={TEAM_OPTIONS}
                value={task.assignee}
                onChange={() => actionNotice('Assignee changed')}
                allowDeselect={false}
              />
            </Box>
            <Box style={{ gridColumn: '1 / -1' }}>
              <Text {...fieldLabelProps} mb={6}>
                Due date
              </Text>
              <TextInput
                value={task.due ? formatDueInput(task.due) : ''}
                readOnly
              />
            </Box>
          </SimpleGrid>
        </CaseDrawerSection>

        <CaseDrawerSection title="Description">
          <Textarea value={task.description} readOnly minRows={4} />
        </CaseDrawerSection>

        <CaseDrawerSection title={`Work logs ${task.workLogs.length}`}>
          <Stack gap={8}>
            {task.workLogs.length ? (
              task.workLogs.map((log) => (
                <Paper
                  key={`${log.author}-${log.time}`}
                  radius="sm"
                  p="sm"
                  bg="gray.0"
                >
                  <Text ff="monospace" fz={12} c="dimmed" mb={6}>
                    {log.author} · {log.time}
                  </Text>
                  <Text fz={13} lh={1.45}>
                    {log.body}
                  </Text>
                </Paper>
              ))
            ) : (
              <Text fz={13} c="dimmed">
                No work logs yet.
              </Text>
            )}
            <Textarea
              placeholder="Add a work log entry — what you did, what you found... (Ctrl+Enter to post)"
              minRows={3}
            />
            <Group justify="flex-end">
              <Button
                size="xs"
                color="orange"
                onClick={() => actionNotice('Work log posted')}
              >
                Post log
              </Button>
            </Group>
          </Stack>
        </CaseDrawerSection>

        <Group
          p={16}
          gap={10}
          wrap="nowrap"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--mantine-color-body)',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <Button
            fullWidth
            variant="default"
            color="red"
            onClick={() => actionNotice('Task delete confirmation opened')}
          >
            Delete
          </Button>
          <Button fullWidth variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            fullWidth
            color="orange"
            onClick={() => actionNotice('Task saved')}
          >
            Save
          </Button>
        </Group>
      </Box>
    </Drawer>
  )
}

function formatTaskDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDueInput(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isTaskOverdue(task: CaseDetailTask) {
  return Boolean(task.due && new Date(task.due).getTime() < Date.now())
}

function DueBadge({ due, done }: { due: string; done: boolean }) {
  return (
    <Badge
      variant={done ? 'light' : 'outline'}
      radius="sm"
      size="sm"
      ff="monospace"
      color={done ? 'gray' : 'red'}
      c={done ? 'dimmed' : 'red'}
      leftSection={<Hourglass size={11} />}
      style={{ flexShrink: 0 }}
    >
      {formatDue(due)}
    </Badge>
  )
}

function ObservablesPanel({ caseDetail }: { caseDetail: CaseDetail }) {
  const [activeObservable, setActiveObservable] =
    useState<CaseDetailObservable | null>(null)
  const observables = caseDetail.observables

  return (
    <Stack gap="md" p="lg">
      <ObservableDetailDrawer
        observable={activeObservable}
        caseDetail={caseDetail}
        onClose={() => setActiveObservable(null)}
      />
      <Table verticalSpacing="sm" horizontalSpacing={0} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th {...fieldLabelProps} fw={500}>
              Type
            </Table.Th>
            <Table.Th {...fieldLabelProps} fw={500}>
              Value
            </Table.Th>
            <Table.Th {...fieldLabelProps} fw={500}>
              Flags
            </Table.Th>
            <Table.Th {...fieldLabelProps} fw={500}>
              Analysis
            </Table.Th>
            <Table.Th {...fieldLabelProps} fw={500} ta="right">
              Added
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {observables.map((observable) => (
            <Table.Tr
              key={observable.value}
              tabIndex={0}
              onClick={() => setActiveObservable(observable)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setActiveObservable(observable)
              }}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Badge variant="default" radius="sm" ff="monospace" fw={500}>
                  {observable.type}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text ff="monospace">{observable.value}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap={8} wrap="nowrap">
                  {observable.ioc ? (
                    <Text ff="monospace" fz={12} fw={700}>
                      IOC
                    </Text>
                  ) : null}
                  {observable.sighted ? (
                    <Text
                      ff="monospace"
                      fz={11}
                      fw={600}
                      tt="uppercase"
                      c="var(--sev-high)"
                    >
                      Sighted
                    </Text>
                  ) : null}
                </Group>
              </Table.Td>
              <Table.Td>
                {observable.analysis === '—' ? (
                  <Text c="dimmed">—</Text>
                ) : (
                  <Badge
                    variant="light"
                    color="indigo"
                    radius="sm"
                    ff="monospace"
                    fw={500}
                    tt="none"
                  >
                    {observable.analysis}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td ta="right">
                <Text ff="monospace" fz={13} c="dimmed">
                  {observable.added}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Box>
        <Button
          variant="default"
          leftSection={<Plus size={16} />}
          onClick={() => actionNotice('Observable picker opened')}
        >
          Add observable
        </Button>
      </Box>
    </Stack>
  )
}

type ObservableVerdict = 'malicious' | 'suspicious' | 'info' | 'clean'

type ObservableTaxonomy = {
  namespace: string
  predicate: string
  value: string
  level: ObservableVerdict
}

type ObservableArtifact = {
  type: string
  value: string
}

type ObservableOperation = {
  kind: string
  params: Record<string, string>
}

type ObservableReport = {
  plugin: string
  version: string
  verdict: ObservableVerdict
  when: string
  cached?: boolean
  taxonomies: ObservableTaxonomy[]
  artifacts: ObservableArtifact[]
  operations: ObservableOperation[]
}

const VERDICT_COLOR: Record<ObservableVerdict, string> = {
  malicious: 'red',
  suspicious: 'yellow',
  info: 'blue',
  clean: 'green',
}

function taxonomy(
  namespace: string,
  predicate: string,
  value: string,
  level: ObservableVerdict,
): ObservableTaxonomy {
  return { namespace, predicate, value, level }
}

function buildObservableReports(
  observable: CaseDetailObservable,
): ObservableReport[] {
  if (observable.type === 'url') {
    return [
      {
        plugin: 'URLscan.io',
        version: '0.4',
        verdict: 'malicious',
        when: '10:33',
        taxonomies: [
          taxonomy('URLscan', 'verdict', 'phishing', 'malicious'),
          taxonomy('URLscan', 'brand', 'China', 'suspicious'),
        ],
        artifacts: [
          { type: 'domain', value: 'cdn-au-billing.net' },
          { type: 'ip', value: '203.0.113.47' },
        ],
        operations: [
          {
            kind: 'create_task',
            params: { title: 'Block landing URL at proxy' },
          },
        ],
      },
      {
        plugin: 'Google Safe Browsing',
        version: '1.0',
        verdict: 'malicious',
        when: '10:32',
        taxonomies: [
          taxonomy('GoogleSB', 'threat', 'SOCIAL_ENGINEERING', 'malicious'),
        ],
        artifacts: [],
        operations: [],
      },
    ]
  }

  if (observable.type === 'domain') {
    return [
      {
        plugin: 'VirusTotal',
        version: '3.1',
        verdict: 'suspicious',
        when: '10:30',
        taxonomies: [
          taxonomy('VirusTotal', 'detection', '12/93', 'suspicious'),
        ],
        artifacts: [{ type: 'ip', value: '203.0.113.47' }],
        operations: [{ kind: 'set_severity', params: { severity: 'High' } }],
      },
    ]
  }

  if (observable.type === 'ip') {
    return [
      {
        plugin: 'AbuseIPDB',
        version: '1.0',
        verdict: 'malicious',
        when: '10:31',
        taxonomies: [
          taxonomy('AbuseIPDB', 'abuse-score', '97%', 'malicious'),
          taxonomy('AbuseIPDB', 'reports', '41', 'suspicious'),
        ],
        artifacts: [{ type: 'domain', value: 'cdn-au-billing.net' }],
        operations: [{ kind: 'mark_as_ioc', params: {} }],
      },
      {
        plugin: 'MaxMind GeoIP',
        version: '4.0',
        verdict: 'info',
        when: '10:31',
        cached: true,
        taxonomies: [
          taxonomy('GeoIP', 'country', 'AU', 'info'),
          taxonomy('GeoIP', 'asn', 'AS7545 TPG', 'info'),
        ],
        artifacts: [],
        operations: [],
      },
    ]
  }

  return [
    {
      plugin: 'ValidateObservable',
      version: '1.0',
      verdict: 'info',
      when: 'now',
      taxonomies: [taxonomy('Validate', 'format', 'valid', 'info')],
      artifacts: [],
      operations: [],
    },
  ]
}

function worstObservableVerdict(
  reports: ObservableReport[],
): ObservableVerdict {
  return (
    (['malicious', 'suspicious', 'info', 'clean'] as const).find((verdict) =>
      reports.some((report) => report.verdict === verdict),
    ) ?? 'info'
  )
}

function ObservableDetailDrawer({
  observable,
  caseDetail,
  onClose,
}: {
  observable: CaseDetailObservable | null
  caseDetail: CaseDetail
  onClose: () => void
}) {
  if (!observable) return null

  const reports = buildObservableReports(observable)
  const verdict = worstObservableVerdict(reports)

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size="min(560px, 94vw)"
      padding={0}
      title={<VisuallyHidden>Observable detail</VisuallyHidden>}
      aria-label="Observable detail"
      closeButtonProps={{ 'aria-label': 'Close observable detail' }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      styles={{
        content: { borderLeft: '1px solid var(--line-soft)' },
        header: {
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--line-soft)',
          padding: '18px 22px 0',
        },
        body: { padding: 0 },
      }}
    >
      <Box
        style={{
          borderLeft: `4px solid var(--mantine-color-${VERDICT_COLOR[verdict]}-6)`,
          marginTop: -44,
          paddingTop: 44,
        }}
      >
        <Box px={22} pb={16}>
          <Text ff="monospace" fz={11} c="dimmed" mb={8}>
            OBSERVABLE · {observable.type}
          </Text>
          <Text
            ff="monospace"
            fw={700}
            fz={16}
            lh={1.35}
            pr={36}
            style={{ wordBreak: 'break-all' }}
          >
            {observable.value}
          </Text>
          <Badge
            mt={14}
            color={VERDICT_COLOR[verdict]}
            variant="light"
            radius="sm"
          >
            {verdict.toUpperCase()}
          </Badge>
        </Box>

        <CaseDrawerSection title="Properties">
          <CaseKeyValue label="Type">{observable.type}</CaseKeyValue>
          <CaseKeyValue label="Value">
            <Text
              component="span"
              ff="monospace"
              fz={12}
              style={{ wordBreak: 'break-all' }}
            >
              {observable.value}
            </Text>
          </CaseKeyValue>
          <CaseKeyValue label="IOC">
            <Text
              component="span"
              c={observable.ioc ? 'red.6' : undefined}
              fw={observable.ioc ? 700 : undefined}
            >
              {observable.ioc ? 'yes' : 'no'}
            </Text>
          </CaseKeyValue>
          <CaseKeyValue label="Sighted">
            {observable.sighted ? 'yes' : 'no'}
          </CaseKeyValue>
          <CaseKeyValue label="First seen">{observable.added}</CaseKeyValue>
          <CaseKeyValue label="Source">{caseDetail.id}</CaseKeyValue>
        </CaseDrawerSection>

        <CaseDrawerSection
          title="Enrichment"
          action={
            <Button
              size="xs"
              variant="default"
              leftSection={<Play size={12} />}
              onClick={() =>
                actionNotice(`Queued analyzers on ${observable.value}`)
              }
            >
              Run analyzers
            </Button>
          }
        >
          <Stack gap={10}>
            {reports.map((report) => (
              <Paper
                key={report.plugin}
                radius="sm"
                p="sm"
                bg="gray.0"
                withBorder
              >
                <Group gap={8} mb={8} wrap="nowrap">
                  <Badge
                    color={VERDICT_COLOR[report.verdict]}
                    variant="light"
                    radius="sm"
                  >
                    {report.verdict.toUpperCase()}
                  </Badge>
                  <Text fw={700} fz={13}>
                    {report.plugin}
                  </Text>
                  <Text ml="auto" ff="monospace" fz={11} c="dimmed">
                    v{report.version} · {report.when}
                    {report.cached ? ' · cached' : ''}
                  </Text>
                </Group>

                <Group
                  gap={6}
                  wrap="wrap"
                  mb={
                    report.artifacts.length || report.operations.length ? 10 : 0
                  }
                >
                  {report.taxonomies.map((taxonomyItem) => (
                    <Badge
                      key={`${report.plugin}-${taxonomyItem.namespace}-${taxonomyItem.predicate}`}
                      variant="outline"
                      color={VERDICT_COLOR[taxonomyItem.level]}
                      radius="sm"
                      ff="monospace"
                      tt="none"
                    >
                      {taxonomyItem.namespace}:{taxonomyItem.predicate}=
                      {taxonomyItem.value}
                    </Badge>
                  ))}
                </Group>

                {report.artifacts.length ? (
                  <Box mt={8}>
                    <Text {...fieldLabelProps} mb={4}>
                      Extracted artifacts
                    </Text>
                    {report.artifacts.map((artifact) => (
                      <Group
                        key={`${report.plugin}-${artifact.type}-${artifact.value}`}
                        py={5}
                        gap={10}
                        wrap="nowrap"
                        style={{ borderBottom: '1px solid var(--line-soft)' }}
                      >
                        <Badge variant="default" radius="sm" ff="monospace">
                          {artifact.type}
                        </Badge>
                        <Text
                          ff="monospace"
                          fz={12}
                          truncate
                          style={{ flex: 1 }}
                        >
                          {artifact.value}
                        </Text>
                        <Button size="compact-xs" variant="default">
                          + add
                        </Button>
                      </Group>
                    ))}
                  </Box>
                ) : null}

                {report.operations.length ? (
                  <Box mt={10}>
                    <Text {...fieldLabelProps} mb={4}>
                      Case operations
                    </Text>
                    {report.operations.map((operation) => (
                      <Text
                        key={`${report.plugin}-${operation.kind}`}
                        fz={12}
                        c="dimmed"
                        py={2}
                      >
                        ▸ <Code>{operation.kind}</Code>{' '}
                        {Object.entries(operation.params)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(' ')}
                      </Text>
                    ))}
                  </Box>
                ) : null}
              </Paper>
            ))}
          </Stack>
        </CaseDrawerSection>

        <CaseDrawerSection title="Seen in cases">
          <Group gap={10} wrap="nowrap">
            <Text ff="monospace" fz={12} c="dimmed">
              {caseDetail.id}
            </Text>
            <Text fz={13} fw={600} truncate style={{ flex: 1 }}>
              {caseDetail.title}
            </Text>
            <StatusBadge
              status={caseDetail.status}
              label={caseDetail.statusName}
            />
          </Group>
        </CaseDrawerSection>

        <Group
          p={16}
          gap={10}
          wrap="nowrap"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--mantine-color-body)',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <Button
            fullWidth
            variant="default"
            onClick={() => actionNotice('IOC flag toggled')}
          >
            Toggle IOC
          </Button>
          <Button
            fullWidth
            variant="default"
            onClick={() => actionNotice('Observable marked sighted')}
          >
            Mark sighted
          </Button>
          <Button
            fullWidth
            color="orange"
            onClick={() => actionNotice('Pushed to MISP event 4417')}
          >
            Export to MISP
          </Button>
        </Group>
      </Box>
    </Drawer>
  )
}

function CaseDrawerSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Box px={22} py={16} style={{ borderTop: '1px solid var(--line-soft)' }}>
      <Group mb={10} gap="xs" wrap="nowrap">
        <Text component="h3" {...fieldLabelProps} m={0}>
          {title}
        </Text>
        {action ? <Group ml="auto">{action}</Group> : null}
      </Group>
      {children}
    </Box>
  )
}

function CaseKeyValue({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Group gap={12} mb={6} wrap="nowrap" align="flex-start">
      <Text ff="monospace" fz={12} c="dimmed" w={110}>
        {label}
      </Text>
      <Box fz={13} style={{ flex: 1 }}>
        {children}
      </Box>
    </Group>
  )
}

const TIMELINE_MARKER: Record<'warn' | 'ok' | 'neutral', string> = {
  warn: 'var(--sev-high)',
  ok: 'var(--ok)',
  neutral: 'var(--muted)',
}

// Renders **bold** spans in timeline text without a full markdown parser.
function BoldText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} component="span" fw={700}>
            {part}
          </Text>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

function TimelinePanel({ timeline }: { timeline: CaseDetailTimelineEvent[] }) {
  return (
    <Stack gap="md" p="lg">
      <Box style={{ position: 'relative' }}>
        <Box
          style={{
            position: 'absolute',
            left: 6,
            top: 10,
            bottom: 10,
            width: 2,
            background: 'var(--line-soft)',
          }}
        />
        <Stack gap={0}>
          {timeline.map((event) => (
            <Group
              key={`${event.when}-${event.text}`}
              gap="md"
              align="flex-start"
              wrap="nowrap"
              py={10}
            >
              <Box
                w={14}
                h={14}
                mt={4}
                style={{
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: `2px solid ${TIMELINE_MARKER[event.tone ?? 'neutral']}`,
                  background: 'var(--mantine-color-body)',
                  zIndex: 1,
                }}
              />
              <Box>
                <Text ff="monospace" fz={12} c="dimmed" mb={2}>
                  {event.when} AEST
                </Text>
                <Text>
                  <BoldText text={event.text} /> &middot;{' '}
                  <Text component="span" c="dimmed">
                    {event.who}
                  </Text>
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Box>

      <Group gap="sm" wrap="nowrap">
        <TextInput flex={1} placeholder="Add a note to the case log…" />
        <Button variant="default" onClick={() => actionNotice('Note posted')}>
          Post
        </Button>
      </Group>
    </Stack>
  )
}

function CommentsPanel({ comments }: { comments: CaseDetailComment[] }) {
  return (
    <Stack gap={0} p="lg">
      {comments.map((comment, index) => {
        const [initials, color] = avatarFor(comment.author)
        return (
          <Group
            key={`${comment.author}-${comment.time}`}
            gap="sm"
            align="flex-start"
            wrap="nowrap"
            py="md"
            style={
              index < comments.length - 1
                ? { borderBottom: '1px solid var(--line-soft)' }
                : undefined
            }
          >
            <Avatar size={32} radius="xl" bg={color} c="white">
              {initials}
            </Avatar>
            <Box flex={1} miw={0}>
              <Group gap={8} mb={4}>
                <Text fw={700}>{comment.author}</Text>
                <Text ff="monospace" fz={12} c="dimmed">
                  {comment.time} AEST
                </Text>
              </Group>
              <Text c="var(--desc)">{comment.body}</Text>
            </Box>
          </Group>
        )
      })}

      <Stack gap="sm" pt="md">
        <Textarea
          autosize
          minRows={3}
          placeholder="Add a comment… @mention a teammate · markdown supported (Ctrl+Enter to post)"
        />
        <Group justify="flex-end">
          <Button color="orange" onClick={() => actionNotice('Comment posted')}>
            Post comment
          </Button>
        </Group>
      </Stack>
    </Stack>
  )
}

function AttachmentsPanel({
  attachments,
}: {
  attachments: CaseDetailAttachment[]
}) {
  return (
    <Stack gap={0} p="lg">
      {attachments.map((file) => (
        <Group
          key={file.name}
          gap="sm"
          wrap="nowrap"
          py={12}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Paper
            withBorder
            radius="sm"
            bg="gray.0"
            w={40}
            h={40}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text ff="monospace" fz={10} fw={700} c="dimmed">
              {file.kind}
            </Text>
          </Paper>
          <Box flex={1} miw={0}>
            <Text fw={600} truncate>
              {file.name}
            </Text>
            <Text ff="monospace" fz={12} c="dimmed" truncate>
              {file.size} &middot; sha256 {file.sha256} &middot; {file.author}{' '}
              &middot; {file.time}
            </Text>
          </Box>
          <Button
            variant="default"
            size="xs"
            leftSection={<Download size={14} />}
            onClick={() => actionNotice(`Downloading ${file.name}`)}
          >
            Download
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<Trash2 size={14} />}
            onClick={() => actionNotice(`${file.name} deleted`)}
          >
            Delete
          </Button>
        </Group>
      ))}

      <Group gap="md" pt="md">
        <Button
          variant="default"
          leftSection={<Upload size={16} />}
          onClick={() => actionNotice('File picker opened')}
        >
          Upload file
        </Button>
        <Text ff="monospace" fz={12} c="dimmed">
          drag &amp; drop or paste · hashed on upload (SHA-256)
        </Text>
      </Group>
    </Stack>
  )
}

function EmptyTab({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Group justify="center" c="dimmed" gap="xs" py={60}>
      {icon}
      <Text fz={14}>{label}</Text>
    </Group>
  )
}

function CaseSideRail({ caseDetail }: { caseDetail: CaseDetail }) {
  return (
    <Stack gap="md">
      <SideCard
        title="Run responder"
        badge="Cortex"
        action={
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Add responder"
            onClick={() => actionNotice('Responder picker opened')}
          >
            <Plus size={16} />
          </ActionIcon>
        }
      >
        <Stack gap="xs">
          {caseDetail.responders.map((responder) => (
            <Button
              key={responder.action}
              variant="default"
              justify="space-between"
              fullWidth
              onClick={() =>
                actionNotice(
                  `${responder.action} queued via ${responder.provider}`,
                )
              }
              rightSection={
                <Text ff="monospace" fz={11} c="dimmed">
                  {responder.provider}
                </Text>
              }
            >
              {responder.action}
            </Button>
          ))}
        </Stack>
      </SideCard>

      <SideCard title="Related cases">
        <Stack gap={0}>
          {caseDetail.related.map((related) => (
            <Group
              key={related.id}
              py={8}
              gap="sm"
              wrap="nowrap"
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Text ff="monospace" fz={13} c="dimmed">
                {related.id}
              </Text>
              <Text fw={600} truncate>
                {related.title}
              </Text>
            </Group>
          ))}
        </Stack>
      </SideCard>

      <SideCard title="TTPs" badge="ATT&CK">
        <Group gap={6} wrap="wrap">
          {caseDetail.ttps.map((ttp) => (
            <Tag key={ttp} label={ttp} />
          ))}
          <Tag label="+ technique" />
        </Group>
      </SideCard>
    </Stack>
  )
}

function SideCard({
  title,
  badge,
  action,
  children,
}: {
  title: string
  badge?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper radius="md" withBorder>
      <Group
        px="md"
        py="sm"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Text fw={700}>{title}</Text>
        {badge ? (
          <Badge variant="default" color="gray" radius="xl">
            {badge}
          </Badge>
        ) : null}
        <Box ml="auto">{action}</Box>
      </Group>
      <Box p="md">{children}</Box>
    </Paper>
  )
}
