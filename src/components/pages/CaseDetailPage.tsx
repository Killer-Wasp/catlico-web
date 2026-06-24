import type {
  CaseDetail,
  CaseDetailAlert,
  CaseDetailAttachment,
  CaseDetailObservable,
  CaseDetailTask,
  CaseDetailTimelineEvent,
} from '#/components/Cases/caseDetails.types'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from '#/components/Observables/observables.types'
import { ObservableDetailDrawer } from '#/components/pages/ObservablesPage'
import type { ReactNode } from 'react'
import { SEV, TLP, type Tlp } from '#/lib/domain'
import { avatarFor } from '#/components/Cases/cases'
import { CaseDescription } from '#/components/Cases/CaseDescription'
import type { MentionUser } from '#/components/Cases/mentionSuggestion'
import {
  mentionableUsersQueryOptions,
  mentionSuggestion,
} from '#/components/Cases/mentionSuggestion'
import {
  caseKeys,
  caseCommentsQueryOptions,
  createCaseComment,
  updateCaseComment,
  createCaseObservable,
  createCaseTask,
  deleteCaseAttachment,
  deleteCaseComment,
  createTaskWorkLog,
  downloadCaseAttachment,
  updateTaskDetailFields,
  updateTaskWorkLog,
  updateCaseAssignee,
  updateCaseDescription,
  uploadCaseAttachment,
} from '#/components/Cases/casesQueries'
import { observableTypesQueryOptions } from '#/components/Settings/settingsQueries'
import { trafficLabel } from '#/components/Cases/caseDetails'
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
  Divider,
  Group,
  Menu,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { RichTextEditor } from '@mantine/tiptap'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FileHandler from '@tiptap/extension-file-handler'
import { Mention } from '@tiptap/extension-mention'
import { Markdown } from '@tiptap/markdown'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock3,
  Download,
  Flag,
  Hourglass,
  Paperclip,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

const fieldLabelProps = {
  ff: 'monospace',
  tt: 'uppercase',
  fz: 10,
  lts: '1px',
  c: 'dimmed',
} as const

const actionNotice = (message: string) =>
  notifications.show({ color: 'orange', message })

export function CaseDetailPage({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
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

      <CaseSummaryCard caseDetail={caseDetail} caseId={caseId} />

      <Box className={classes.caseDetailLayout} mt="md">
        <CaseBody caseDetail={caseDetail} caseId={caseId} />
        <CaseSideRail caseDetail={caseDetail} />
      </Box>
    </Box>
  )
}

function CaseSummaryCard({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [initials, color] = avatarFor(caseDetail.assignee)
  const { data: members } = useQuery(mentionableUsersQueryOptions())

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      updateCaseAssignee(caseId, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      notifications.show({ color: 'green', message: 'Assignee updated' })
    },
    onError: () => {
      notifications.show({ color: 'red', message: 'Failed to update assignee' })
    },
  })

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

          <Title order={1} size="h2" mb={14}>
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
          <Menu shadow="md" width={260} position="bottom-end">
            <Menu.Target>
              <Button
                variant="default"
                leftSection={<UserPlus size={16} />}
                loading={assignMutation.isPending}
              >
                Assign
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={
                  <Avatar size={24} radius="xl" bg="#54463A">
                    —
                  </Avatar>
                }
                onClick={() => assignMutation.mutate(null)}
              >
                Unassigned
              </Menu.Item>
              {members?.map((member) => {
                const [mi, mc] = avatarFor(member.email)
                return (
                  <Menu.Item
                    key={member.id}
                    leftSection={
                      <Avatar size={24} radius="xl" bg={mc}>
                        {mi}
                      </Avatar>
                    }
                    onClick={() => assignMutation.mutate(member.id)}
                  >
                    {member.label}
                  </Menu.Item>
                )
              })}
            </Menu.Dropdown>
          </Menu>
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
        <Menu shadow="md" width={260} position="bottom-start">
          <Menu.Target>
            <Button
              variant="default"
              leftSection={<UserPlus size={16} />}
              loading={assignMutation.isPending}
            >
              Assign
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <Avatar size={24} radius="xl" bg="#54463A">
                  —
                </Avatar>
              }
              onClick={() => assignMutation.mutate(null)}
            >
              Unassigned
            </Menu.Item>
            {members?.map((member) => {
              const [mi, mc] = avatarFor(member.email)
              return (
                <Menu.Item
                  key={member.id}
                  leftSection={
                    <Avatar size={24} radius="xl" bg={mc}>
                      {mi}
                    </Avatar>
                  }
                  onClick={() => assignMutation.mutate(member.id)}
                >
                  {member.label}
                </Menu.Item>
              )
            })}
          </Menu.Dropdown>
        </Menu>
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

function CaseBody({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
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
      <Tabs value={activeTab} color="orange">
        <Tabs.List px="md">
          {tabDefs.map(({ value, label }) => (
            <Tabs.Tab
              key={value}
              value={value}
              p="md"
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
  caseId,
}: {
  tab: CaseTab
  caseDetail: CaseDetail
  caseId: string
}) {
  switch (tab) {
    case 'tasks':
      return <TasksPanel caseDetail={caseDetail} caseId={caseId} />
    case 'observables':
      return <ObservablesPanel caseDetail={caseDetail} caseId={caseId} />
    case 'comments':
      return <CommentsPanel caseId={caseId} />
    case 'attachments':
      return (
        <AttachmentsPanel
          attachments={caseDetail.attachments}
          caseId={caseId}
        />
      )
    case 'timeline':
      return <TimelinePanel timeline={caseDetail.timeline} caseId={caseId} />
    case 'sharing':
      return (
        <EmptyTab
          icon={<ShieldCheck size={18} />}
          label={`${caseDetail.shares} external sharing entries are active.`}
        />
      )
    case 'details':
    default:
      return <DetailsPanel caseDetail={caseDetail} caseId={caseId} />
  }
}

function DetailsPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const queryClient = useQueryClient()
  const saveDescription = useMutation({
    mutationFn: (markdown: string) => updateCaseDescription(caseId, markdown),
    onSuccess: (_data, markdown) => {
      // Reflect the saved value immediately in the cached detail (the tab reads
      // it via useSuspenseQuery), then refetch to reconcile with the server.
      queryClient.setQueryData(
        caseKeys.fullDetail(caseId),
        (old: CaseDetail | undefined) =>
          old ? { ...old, descriptionMarkdown: markdown } : old,
      )
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) })
    },
  })

  return (
    <Stack gap="lg" p="lg">
      <CaseDescription
        markdown={caseDetail.descriptionMarkdown}
        onSave={(markdown) => saveDescription.mutateAsync(markdown)}
      />

      {caseDetail.summary && (
        <Text fz={15} lh={1.45} c="var(--desc)">
          <Text component="span" fw={700}>
            Working hypothesis:
          </Text>{' '}
          {caseDetail.summary}
        </Text>
      )}

      <Box>
        <Text {...fieldLabelProps} mb="sm">
          Custom fields
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
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

const TASK_STATUS_OPTIONS = (
  ['waiting', 'inprogress', 'completed', 'cancel'] as const
).map((value) => ({ value, label: TASK_STATUS[value].label }))

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

function TasksPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const [activeTask, setActiveTask] = useState<CaseDetailTask | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const tasks = caseDetail.tasks
  const queryClient = useQueryClient()

  const addTask = useMutation({
    mutationFn: (title: string) => createCaseTask(caseId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setNewTaskTitle('')
      actionNotice('Task added')
    },
    onError: () => actionNotice('Failed to add task'),
  })

  function submitNewTask() {
    const title = newTaskTitle.trim()
    if (!title || addTask.isPending) return
    addTask.mutate(title)
  }

  if (activeTask) {
    return (
      <Stack gap={0} p="lg">
        <TaskDetailPanel
          task={activeTask}
          caseDetail={caseDetail}
          caseId={caseId}
          onTaskChange={(patch) =>
            setActiveTask((task) => (task ? { ...task, ...patch } : task))
          }
          onBack={() => setActiveTask(null)}
        />
      </Stack>
    )
  }

  return (
    <Stack gap={0} p="lg">
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
          value={newTaskTitle}
          onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitNewTask()
          }}
          disabled={addTask.isPending}
        />
        <Button
          variant="default"
          onClick={submitNewTask}
          loading={addTask.isPending}
          disabled={!newTaskTitle.trim()}
        >
          Add
        </Button>
      </Group>
    </Stack>
  )
}

function TaskDetailPanel({
  task,
  caseDetail,
  caseId,
  onTaskChange,
  onBack,
}: {
  task: CaseDetailTask
  caseDetail: CaseDetail
  caseId: string
  onTaskChange: (patch: Partial<CaseDetailTask>) => void
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [editingDescription, setEditingDescription] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)

  async function saveDescription(markdown: string) {
    setSavingDescription(true)
    try {
      await updateTaskDetailFields({
        caseId: task.caseId,
        taskId: task.apiId,
        description: markdown,
      })
      onTaskChange({ description: markdown })
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setEditingDescription(false)
      actionNotice('Task description saved')
    } finally {
      setSavingDescription(false)
    }
  }

  async function updateStatus(status: CaseDetailTask['status'] | null) {
    if (!status || status === task.status) return
    onTaskChange({ status })
    await updateTaskDetailFields({ caseId: task.caseId, taskId: task.apiId, status })
    queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    actionNotice(`Task status set to ${TASK_STATUS[status].label}`)
  }

  return (
    <Box
      style={{
        borderLeft: `4px solid ${TASK_EDGE_COLOR[task.status]}`,
      }}
    >
      <Group px={22} pb={12}>
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<ArrowLeft size={14} />}
          onClick={onBack}
        >
          Back to tasks
        </Button>
      </Group>

      <Box px={22} pb={16}>
        <Text ff="monospace" fz={12} c="dimmed" mb={8}>
          {caseDetail.id} · task {task.id}
        </Text>
        <TextInput
          value={task.title}
          readOnly
          rightSection={
            task.flagged ? (
              <Flag size={16} color="var(--sev-high)" fill="var(--sev-high)" />
            ) : null
          }
          styles={{ input: { fontWeight: 700, fontSize: 18 } }}
        />
      </Box>

      <CaseDrawerSection title="Status">
        <Select
          label="Status"
          data={TASK_STATUS_OPTIONS}
          value={task.status}
          onChange={(value) => updateStatus(value)}
          allowDeselect={false}
          w={{ base: '100%', sm: 240 }}
        />
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

      <CaseDrawerSection
        title="Description"
        action={
          !editingDescription ? (
            <Button
              size="xs"
              variant="default"
              leftSection={<Pencil size={13} />}
              onClick={() => setEditingDescription(true)}
            >
              Edit description
            </Button>
          ) : null
        }
      >
        {editingDescription ? (
          <TaskMarkdownEditor
            ariaLabel="Task description"
            initialMarkdown={task.description}
            saveLabel="Save description"
            saving={savingDescription}
            onSave={saveDescription}
          />
        ) : (
          <Paper withBorder radius="sm" p="sm" bg="gray.0">
            <Text fz={14} lh={1.45}>
              {task.description || 'No description yet.'}
            </Text>
          </Paper>
        )}
      </CaseDrawerSection>

      <TaskWorkLogsSection
        task={task}
        caseId={caseId}
        onTaskChange={onTaskChange}
      />
    </Box>
  )
}

function TaskMarkdownEditor({
  initialMarkdown,
  saveLabel,
  ariaLabel,
  saving = false,
  files,
  onFilesChange,
  onSave,
}: {
  initialMarkdown: string
  saveLabel: string
  ariaLabel: string
  saving?: boolean
  files?: File[]
  onFilesChange?: (files: File[]) => void
  onSave: (markdown: string) => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<File[]>(files ?? [])
  const onFilesChangeRef = useRef<typeof onFilesChange>(onFilesChange)

  useEffect(() => {
    filesRef.current = files ?? []
    onFilesChangeRef.current = onFilesChange
  }, [files, onFilesChange])

  const appendFiles = (nextFiles: File[]) => {
    if (!onFilesChangeRef.current || !nextFiles.length) return
    onFilesChangeRef.current([...filesRef.current, ...nextFiles])
  }
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      ...(onFilesChange
        ? [
            FileHandler.configure({
              onDrop: (_editor, droppedFiles) => appendFiles(droppedFiles),
              onPaste: (_editor, pastedFiles) => appendFiles(pastedFiles),
            }),
          ]
        : []),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
      },
    },
  })

  useEffect(() => {
    editor?.commands.setContent(initialMarkdown, { contentType: 'markdown' })
  }, [editor, initialMarkdown])

  const save = async () => {
    if (!editor) return
    await onSave(editor.isEmpty ? '' : editor.getMarkdown())
  }

  return (
    <RichTextEditor editor={editor}>
      <RichTextEditor.Toolbar>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.Blockquote />
          <RichTextEditor.CodeBlock />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
        {onFilesChange ? (
          <Box ml="auto">
            <RichTextEditor.Control
              aria-label="Attach files"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={16} />
            </RichTextEditor.Control>
          </Box>
        ) : (
          <Box ml="auto" />
        )}
        <Button
          size="compact-xs"
          color="orange"
          loading={saving}
          onClick={save}
        >
          {saveLabel}
        </Button>
      </RichTextEditor.Toolbar>
      {onFilesChange ? (
        <input
          ref={fileInputRef}
          aria-label={
            ariaLabel === 'Add work log'
              ? 'Work log attachments'
              : `${ariaLabel} file picker`
          }
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => {
            appendFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
      ) : null}
      <RichTextEditor.Content />
      {files?.length ? (
        <Group gap={6} p="xs" wrap="wrap">
          {files.map((file) => (
            <Badge
              key={`${file.name}-${file.size}`}
              variant="default"
              radius="sm"
              leftSection={<Paperclip size={12} />}
            >
              {file.name}
            </Badge>
          ))}
        </Group>
      ) : null}
    </RichTextEditor>
  )
}

function TaskWorkLogsSection({
  task,
  caseId,
  onTaskChange,
}: {
  task: CaseDetailTask
  caseId: string
  onTaskChange: (patch: Partial<CaseDetailTask>) => void
}) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [savingNew, setSavingNew] = useState(false)

  async function saveNewLog(markdown: string) {
    setSavingNew(true)
    try {
      const log = await createTaskWorkLog({
        caseId: task.caseId,
        taskId: task.apiId,
        bodyMarkdown: markdown,
        files,
      })
      onTaskChange({
        workLogs: [...task.workLogs, log],
        logs: task.workLogs.length + 1,
      })
      setFiles([])
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      actionNotice('Work log saved')
    } finally {
      setSavingNew(false)
    }
  }

  return (
    <CaseDrawerSection title={`Work logs ${task.workLogs.length}`}>
      <Stack gap="sm">
        {task.workLogs.length ? (
          task.workLogs.map((log) => (
            <TaskWorkLogCard
              key={log.id}
              task={task}
              log={log}
              caseId={caseId}
              onTaskChange={onTaskChange}
            />
          ))
        ) : (
          <Text fz={13} c="dimmed">
            No work logs yet.
          </Text>
        )}

        <TaskMarkdownEditor
          ariaLabel="Add work log"
          initialMarkdown=""
          saveLabel="Save work log"
          saving={savingNew}
          files={files}
          onFilesChange={setFiles}
          onSave={saveNewLog}
        />
      </Stack>
    </CaseDrawerSection>
  )
}

function TaskWorkLogCard({
  task,
  log,
  caseId,
  onTaskChange,
}: {
  task: CaseDetailTask
  log: CaseDetailTask['workLogs'][number]
  caseId: string
  onTaskChange: (patch: Partial<CaseDetailTask>) => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(markdown: string) {
    setSaving(true)
    try {
      const updated = await updateTaskWorkLog({
        caseId: task.caseId,
        taskId: task.apiId,
        logId: log.apiId,
        bodyMarkdown: markdown,
      })
      onTaskChange({
        workLogs: task.workLogs.map((item) =>
          item.id === log.id ? { ...item, ...updated } : item,
        ),
      })
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setEditing(false)
      actionNotice('Work log updated')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper radius="sm" p="sm" bg="gray.0" withBorder>
      <Group justify="space-between" align="flex-start" gap="sm" mb={6}>
        <Text ff="monospace" fz={12} c="dimmed">
          {log.author} · {log.time}
        </Text>
        {!editing ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<Pencil size={13} />}
            onClick={() => setEditing(true)}
          >
            Edit work log from {log.author} at {log.time}
          </Button>
        ) : null}
      </Group>

      {editing ? (
        <TaskMarkdownEditor
          ariaLabel={`Edit work log ${log.id}`}
          initialMarkdown={log.body}
          saveLabel="Save work log"
          saving={saving}
          onSave={save}
        />
      ) : (
        <Text fz={13} lh={1.45}>
          {log.body}
        </Text>
      )}

      {log.attachments.length ? (
        <Group gap={6} mt="sm" wrap="wrap">
          {log.attachments.map((attachment) => (
            <Badge
              key={attachment.id}
              variant="outline"
              radius="sm"
              leftSection={<Paperclip size={12} />}
            >
              {attachment.name}
              {attachment.size ? ` · ${attachment.size}` : ''}
            </Badge>
          ))}
        </Group>
      ) : null}
    </Paper>
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

const CASE_OBSERVABLE_TYPE_MAP: Record<string, ObservableType> = {
  domain: 'domain',
  url: 'url',
  mail: 'mail',
  email: 'mail',
  ip: 'ip',
  ipv4: 'ip',
  ipv6: 'ip',
  hash: 'hash',
  file: 'file',
  filename: 'file',
  other: 'other',
}

function toObservable(
  observable: CaseDetailObservable,
  caseDetail: CaseDetail,
): Observable {
  const flags: ObservableFlag[] = []
  if (observable.ioc) flags.push('ioc')
  if (observable.sighted) flags.push('sighted')

  return {
    id: observable.id,
    type: CASE_OBSERVABLE_TYPE_MAP[observable.type.toLowerCase()] ?? 'other',
    value: observable.value,
    flags,
    tlp: caseDetail.tlp,
    source: caseDetail.id,
    ...(observable.analysis.trim() && observable.analysis !== '—'
      ? { analysis: { analyzer: 'Note', verdict: observable.analysis } }
      : {}),
    added: observable.added,
  }
}

function ObservablesPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const [activeObservable, setActiveObservable] =
    useState<CaseDetailObservable | null>(null)
  const [addingObservable, setAddingObservable] = useState(false)
  const [newType, setNewType] = useState<string | null>(null)
  const [newData, setNewData] = useState('')
  const [newTlp, setNewTlp] = useState<string>('2')
  const [newIoc, setNewIoc] = useState(false)
  const [newSighted, setNewSighted] = useState(false)
  const queryClient = useQueryClient()

  const { data: obsTypes } = useQuery(observableTypesQueryOptions())
  const nonAttachmentTypes = (obsTypes ?? [])
    .filter((t) => !t.is_attachment)
    .map((t) => t.name)

  const addObservable = useMutation({
    mutationFn: () =>
      createCaseObservable(caseId, {
        observable_type: newType!,
        data: newData,
        tlp: Number(newTlp),
        ioc: newIoc,
        sighted: newSighted,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setAddingObservable(false)
      setNewType(null)
      setNewData('')
      setNewTlp('2')
      setNewIoc(false)
      setNewSighted(false)
    },
  })

  const observables = caseDetail.observables
  const drawerObservable = activeObservable
    ? toObservable(activeObservable, caseDetail)
    : null

  return (
    <Stack gap="md" p="lg">
      <ObservableDetailDrawer
        observable={drawerObservable}
        onClose={() => setActiveObservable(null)}
      />

      <Modal
        opened={addingObservable}
        onClose={() => setAddingObservable(false)}
        title="Add observable"
      >
        <Stack gap="md">
          <Select
            label="Type"
            data={nonAttachmentTypes.map((name) => ({
              value: name,
              label: name,
            }))}
            value={newType}
            onChange={setNewType}
            required
          />
          <TextInput
            label="Value"
            value={newData}
            onChange={(e) => setNewData(e.currentTarget.value)}
            required
          />
          <Select
            label="TLP"
            data={[0, 1, 2, 3].map((n) => ({
              value: String(n),
              label: `${n} — ${TLP[n as Tlp]}`,
            }))}
            value={newTlp}
            onChange={(v) => setNewTlp(v ?? '2')}
          />
          <Checkbox
            label="IOC (indicator of compromise)"
            checked={newIoc}
            onChange={(e) => setNewIoc(e.currentTarget.checked)}
          />
          <Checkbox
            label="Sighted"
            checked={newSighted}
            onChange={(e) => setNewSighted(e.currentTarget.checked)}
          />
          <Button
            fullWidth
            disabled={!newType || !newData.trim()}
            loading={addObservable.isPending}
            onClick={() => addObservable.mutate()}
          >
            Add observable
          </Button>
        </Stack>
      </Modal>
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
          onClick={() => setAddingObservable(true)}
        >
          Add observable
        </Button>
      </Box>
    </Stack>
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

const TIMELINE_MARKER: Record<'warn' | 'ok' | 'neutral' | 'comment', string> = {
  warn: 'var(--sev-high)',
  ok: 'var(--ok)',
  neutral: 'var(--muted)',
  comment: 'var(--mantine-color-blue-6)',
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

function TimelinePanel({
  timeline,
  caseId,
}: {
  timeline: CaseDetailTimelineEvent[]
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)

  const markerColor = (event: CaseDetailTimelineEvent) =>
    event.kind === 'comment'
      ? TIMELINE_MARKER.comment
      : TIMELINE_MARKER[event.tone ?? 'neutral']

  // ponytail: inline comment key, dedup index when comment id absent
  let commentIndex = 0
  function eventKey(event: CaseDetailTimelineEvent) {
    if (event.kind === 'comment') return `comment-${commentIndex++}`
    return `audit-${event.createdAt}`
  }

  async function post() {
    const trimmed = note.trim()
    if (!trimmed || posting) return
    setPosting(true)
    try {
      await createCaseComment(caseId, trimmed)
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setNote('')
    } catch {
      actionNotice('Failed to post note')
    } finally {
      setPosting(false)
    }
  }

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
              key={eventKey(event)}
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
                  border: `2px solid ${markerColor(event)}`,
                  background:
                    event.kind === 'comment'
                      ? markerColor(event)
                      : 'var(--mantine-color-body)',
                  zIndex: 1,
                }}
              />
              {event.kind === 'comment' ? (
                <Box flex={1} miw={0}>
                  <Group gap={8} mb={4}>
                    <Text fw={700}>{event.who}</Text>
                    <Text ff="monospace" fz={12} c="dimmed">
                      {event.when} AEST
                    </Text>
                  </Group>
                  <Text>{event.text}</Text>
                </Box>
              ) : (
                <Box>
                  <Text ff="monospace" fz={12} c="dimmed" mb={2}>
                    {event.when} AEST
                  </Text>
                  <Text>
                    {event.link ? (
                      <Text
                        component={Link}
                        to={event.link}
                        style={{ textDecoration: 'none', cursor: 'pointer' }}
                      >
                        <BoldText text={event.text} />
                      </Text>
                    ) : (
                      <BoldText text={event.text} />
                    )}{' '}
                    &middot;{' '}
                    <Text component="span" c="dimmed">
                      {event.who}
                    </Text>
                  </Text>
                </Box>
              )}
            </Group>
          ))}
        </Stack>
      </Box>

      <Group gap="sm" wrap="nowrap">
        <TextInput
          flex={1}
          placeholder="Add a note to the case log…"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              post()
            }
          }}
        />
        <Button variant="default" onClick={post} loading={posting}>
          Post
        </Button>
      </Group>
    </Stack>
  )
}

function CommentsPanel({
  caseId,
}: {
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data: comments = [] } = useQuery(
    caseCommentsQueryOptions(caseId, sortOrder),
  )

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => deleteCaseComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
  })

  const editingComment = editingCommentId
    ? comments.find((c) => c.id === editingCommentId)
    : null

  return (
    <Stack gap={0} p="lg">
      <Group justify="flex-end" mb="xs">
        <Menu shadow="md" width={160}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              {sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<ArrowDown size={14} />}
              rightSection={sortOrder === 'desc' ? '✓' : undefined}
              onClick={() => setSortOrder('desc')}
            >
              Newest first
            </Menu.Item>
            <Menu.Item
              leftSection={<ArrowUp size={14} />}
              rightSection={sortOrder === 'asc' ? '✓' : undefined}
              onClick={() => setSortOrder('asc')}
            >
              Oldest first
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <CaseCommentEditor
        caseId={caseId}
        editingComment={
          editingComment
            ? { id: editingComment.id, body: editingComment.body }
            : null
        }
        onEditDone={() => setEditingCommentId(null)}
      />

      {comments.map((comment, index) => {
        const [initials, color] = avatarFor(comment.author)
        return (
          <Group
            key={comment.id}
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
            <Menu shadow="md" width={120}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <Pencil size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Pencil size={14} />}
                  onClick={() => setEditingCommentId(comment.id)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<Trash2 size={14} />}
                  color="red"
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )
      })}
    </Stack>
  )
}

function CaseCommentEditor({
  caseId,
  editingComment,
  onEditDone,
}: {
  caseId: string
  editingComment?: { id: string; body: string } | null
  onEditDone?: () => void
}) {
  const [empty, setEmpty] = useState(true)
  const [posting, setPosting] = useState(false)
  const { data: mentionUsers } = useQuery(mentionableUsersQueryOptions())
  const usersRef = useRef<MentionUser[]>([])
  const queryClient = useQueryClient()
  const editIdRef = useRef<string | null>(null)

  useEffect(() => {
    usersRef.current = mentionUsers ?? []
  }, [mentionUsers])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Mention.configure({
        suggestion: mentionSuggestion(() => usersRef.current),
      }),
    ],
    content: '',
    contentType: 'markdown',
    immediatelyRender: false,
    onCreate: ({ editor: activeEditor }) => setEmpty(activeEditor.isEmpty),
    onUpdate: ({ editor: activeEditor }) => setEmpty(activeEditor.isEmpty),
    editorProps: {
      attributes: {
        'aria-label': editingComment ? 'Edit comment' : 'Add a comment',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          save()
          return true
        }
        return false
      },
    },
  })

  // Populate editor when entering edit mode or clear when leaving it
  useEffect(() => {
    if (!editor) return
    const prevId = editIdRef.current
    editIdRef.current = editingComment?.id ?? null
    if (editingComment && editingComment.id !== prevId) {
      editor.commands.setContent(editingComment.body, { contentType: 'markdown' })
    } else if (!editingComment && prevId) {
      editor.commands.clearContent()
      setEmpty(true)
    }
  }, [editor, editingComment])

  async function save() {
    if (!editor || editor.isEmpty || posting) return
    const markdown = editor.getMarkdown() as string
    if (!markdown.trim()) return
    setPosting(true)
    try {
      if (editingComment) {
        await updateCaseComment(editingComment.id, markdown)
        actionNotice('Comment updated')
        onEditDone?.()
      } else {
        await createCaseComment(caseId, markdown)
        actionNotice('Comment posted')
        editor.commands.clearContent()
        setEmpty(true)
      }
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    } catch {
      actionNotice(editingComment ? 'Failed to update comment' : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Stack gap="sm" pt="md">
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
            <RichTextEditor.Code />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
            <RichTextEditor.CodeBlock />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
          {editingComment && (
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              onClick={() => onEditDone?.()}
              ml="auto"
            >
              Cancel
            </Button>
          )}
          <Button
            color="orange"
            size="xs"
            onClick={save}
            disabled={empty}
            ml={editingComment ? undefined : 'auto'}
          >
            {editingComment ? 'Save comment' : 'Post comment'}
          </Button>
        </RichTextEditor.Toolbar>
        <ScrollArea h={120}>
          <RichTextEditor.Content />
        </ScrollArea>
      </RichTextEditor>
    </Stack>
  )
}

function AttachmentsPanel({
  attachments,
  caseId,
}: {
  attachments: CaseDetailAttachment[]
  caseId: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropZoneRef = useRef<HTMLDivElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCaseAttachment(caseId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
    onError: () => actionNotice('Upload failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: number) => deleteCaseAttachment(caseId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
    onError: () => actionNotice('Delete failed'),
  })

  async function handleDownload(attachment: CaseDetailAttachment) {
    try {
      await downloadCaseAttachment(caseId, attachment.linkId, attachment.name)
    } catch {
      actionNotice(`Download failed for ${attachment.name}`)
    }
  }

  function handleFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) uploadMutation.mutate(f)
  }

  // paste handler on the upload area
  useEffect(() => {
    const el = dropZoneRef.current
    if (!el) return
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData?.files.length) return
      e.preventDefault()
      handleFiles(e.clipboardData.files)
    }
    el.addEventListener('paste', onPaste)
    return () => el.removeEventListener('paste', onPaste)
  }, [caseId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack gap={0} p="lg">
      {attachments.map((file) => (
        <Group
          key={file.linkId}
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
            onClick={() => handleDownload(file)}
          >
            Download
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<Trash2 size={14} />}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(file.linkId)}
          >
            Delete
          </Button>
        </Group>
      ))}

      <Box
        ref={dropZoneRef}
        pt="md"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: dragOver
            ? '2px dashed var(--mantine-color-orange-5)'
            : '2px dashed transparent',
          borderRadius: 'var(--mantine-radius-sm)',
          transition: 'border 0.15s',
        }}
      >
        <Group gap="md">
          <Button
            variant="default"
            leftSection={<Upload size={16} />}
            loading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            aria-label="Case attachment file picker"
            type="file"
            style={{ display: 'none' }}
            onChange={(event) => {
              const f = event.currentTarget.files?.[0]
              if (f) uploadMutation.mutate(f)
              event.currentTarget.value = ''
            }}
          />
          <Text ff="monospace" fz={12} c="dimmed">
            drag &amp; drop or paste &middot; hashed on upload (SHA-256)
          </Text>
        </Group>
      </Box>
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
