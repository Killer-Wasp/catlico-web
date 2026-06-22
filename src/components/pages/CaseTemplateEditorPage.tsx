import classes from '#/components/Cases/CasesPage.module.css'
import type {
  CaseTemplate,
  CaseTemplateCustomField,
  CaseTemplateTask,
  CustomFieldType,
} from '#/components/Cases/caseTemplates.types'
import {
  severityTemplateLabel,
  trafficTemplateLabel,
} from '#/components/Cases/caseTemplates'
import {
  caseTemplateKeys,
  caseTemplateQueryOptions,
  createCaseTemplate,
  deleteCaseTemplate,
  exportCaseTemplate,
  updateCaseTemplate,
} from '#/components/Cases/caseTemplatesQueries'
import type { Pap, Severity, Tlp } from '#/lib/domain'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Flag, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type DraftTask = CaseTemplateTask & {
  dueAmount: string
  dueUnit: 'hours' | 'days'
}

type DraftTemplate = Omit<CaseTemplate, 'tasks'> & {
  tasks: DraftTask[]
}

const severityOptions = [
  { value: '1', label: 'LOW' },
  { value: '2', label: 'MEDIUM' },
  { value: '3', label: 'HIGH' },
  { value: '4', label: 'CRITICAL' },
]

const trafficOptions = [
  { value: '0', label: 'WHITE' },
  { value: '1', label: 'GREEN' },
  { value: '2', label: 'AMBER' },
  { value: '3', label: 'RED' },
]

function TemplateSegmentedControl<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <Box>
      <Text fw={600} size="sm" mb={6}>
        {label}
      </Text>
      <Group gap={6} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.value === String(value)
          return (
            <Button
              key={option.value}
              type="button"
              size="xs"
              variant={active ? 'filled' : 'default'}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(Number(option.value) as T)}
            >
              {option.label}
            </Button>
          )
        })}
      </Group>
    </Box>
  )
}

const assigneeOptions = [
  { value: '', label: 'Unassigned' },
  { value: 'J. Tanaka', label: 'J. Tanaka' },
  { value: 'P. Nguyen', label: 'P. Nguyen' },
  { value: 'A. Whitford', label: 'A. Whitford' },
  { value: 'S. Iyer', label: 'S. Iyer' },
]

const customFieldTypes: CustomFieldType[] = [
  'string',
  'integer',
  'float',
  'boolean',
  'date',
]

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

function dueFromHours(hours: number) {
  if (hours >= 24 && hours % 24 === 0) {
    return { dueAmount: String(hours / 24), dueUnit: 'days' as const }
  }

  return { dueAmount: String(hours), dueUnit: 'hours' as const }
}

function hoursFromDue(amount: string, unit: DraftTask['dueUnit']) {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return unit === 'days' ? Math.round(parsed * 24) : Math.round(parsed)
}

function toDraft(template: CaseTemplate): DraftTemplate {
  return {
    ...template,
    tags: [...template.tags],
    tasks: template.tasks.map((task) => ({
      ...task,
      ...dueFromHours(task.dueInHours),
    })),
    customFields: template.customFields.map((field) => ({ ...field })),
  }
}

function newDraft(): DraftTemplate {
  return {
    id: '',
    slug: '',
    name: '',
    builtin: false,
    updated: 'just now',
    description: '',
    prefix: '',
    assignee: '',
    sev: 2,
    tlp: 2,
    pap: 2,
    tags: [],
    tasks: [],
    customFields: [],
  }
}

function Panel({
  title,
  badge,
  action,
  children,
}: {
  title: string
  badge?: string | number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Paper
      withBorder
      radius="md"
      shadow="sm"
      bg="body"
      style={{ overflow: 'hidden' }}
    >
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
          {badge !== undefined ? (
            <Badge variant="default" color="gray" radius="xl" ff="monospace">
              {badge}
            </Badge>
          ) : null}
        </Group>
        {action}
      </Group>
      {children}
    </Paper>
  )
}

function updateTask(
  tasks: DraftTask[],
  index: number,
  patch: Partial<DraftTask>,
) {
  return tasks.map((task, taskIndex) =>
    taskIndex === index ? { ...task, ...patch } : task,
  )
}

function moveTask(tasks: DraftTask[], index: number, direction: -1 | 1) {
  const next = [...tasks]
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function TaskEditor({
  task,
  index,
  onUpdate,
  onRemove,
  onMove,
}: {
  task: DraftTask
  index: number
  onUpdate: (patch: Partial<DraftTask>) => void
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <Paper p="md" radius="md" bg="gray.0" withBorder>
      <Stack gap="sm">
        <Group gap="sm" align="center" wrap="nowrap">
          <Text ff="monospace" c="dimmed" w={24} ta="right">
            {index + 1}
          </Text>
          <TextInput
            value={task.title}
            onChange={(event) => onUpdate({ title: event.currentTarget.value })}
            placeholder="Task title"
            aria-label={`Task ${index + 1} title`}
            style={{ flex: 1 }}
          />
          <TextInput
            value={task.group}
            onChange={(event) => onUpdate({ group: event.currentTarget.value })}
            placeholder="Group"
            aria-label={`Task ${index + 1} group`}
            w={180}
          />
          <ActionIcon
            variant={task.flagged ? 'filled' : 'default'}
            color={task.flagged ? 'orange' : 'gray'}
            aria-label={`Flag task ${index + 1}`}
            onClick={() => onUpdate({ flagged: !task.flagged })}
          >
            <Flag size={15} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label={`Move task ${index + 1} up`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label={`Move task ${index + 1} down`}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            color="red"
            aria-label={`Remove task ${index + 1}`}
            onClick={onRemove}
          >
            <X size={15} />
          </ActionIcon>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Textarea
            label="Description"
            value={task.description}
            minRows={2}
            onChange={(event) =>
              onUpdate({ description: event.currentTarget.value })
            }
          />
          <Box>
            <Text ff="monospace" fz={10} c="dimmed" tt="uppercase" mb={4}>
              Due in
            </Text>
            <Group gap={6} wrap="nowrap">
              <TextInput
                type="number"
                min={0}
                value={task.dueAmount}
                onChange={(event) =>
                  onUpdate({ dueAmount: event.currentTarget.value })
                }
                aria-label={`Task ${index + 1} due amount`}
              />
              <Select
                data={['hours', 'days']}
                value={task.dueUnit}
                onChange={(value) => onUpdate({ dueUnit: value ?? 'hours' })}
                aria-label={`Task ${index + 1} due unit`}
                w={96}
              />
            </Group>
          </Box>
        </SimpleGrid>
      </Stack>
    </Paper>
  )
}

function CustomFieldEditor({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: CaseTemplateCustomField
  index: number
  onUpdate: (patch: Partial<CaseTemplateCustomField>) => void
  onRemove: () => void
}) {
  return (
    <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm" verticalSpacing="sm">
      <TextInput
        value={field.label}
        placeholder="Label"
        aria-label={`Custom field ${index + 1} label`}
        onChange={(event) => {
          const label = event.currentTarget.value
          onUpdate({
            label,
            key: label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/(^_|_$)/g, ''),
          })
        }}
      />
      <Select
        data={customFieldTypes}
        value={field.type}
        aria-label={`Custom field ${index + 1} type`}
        onChange={(value) => onUpdate({ type: value ?? 'string' })}
      />
      <TextInput
        value={field.defaultValue}
        placeholder="Default value"
        aria-label={`Custom field ${index + 1} default value`}
        onChange={(event) =>
          onUpdate({ defaultValue: event.currentTarget.value })
        }
      />
      <ActionIcon
        variant="default"
        color="red"
        aria-label={`Remove custom field ${index + 1}`}
        onClick={onRemove}
      >
        <X size={15} />
      </ActionIcon>
    </SimpleGrid>
  )
}

function tagsToText(tags: string[]) {
  return tags.join(', ')
}

function textToTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function toSavedTemplate(draft: DraftTemplate): CaseTemplate {
  const displayName = draft.name.trim()
  const slug = toSlug(draft.slug || draft.id || displayName)

  return {
    ...draft,
    id: draft.id || slug || `tpl-${Date.now().toString(36)}`,
    slug,
    name: displayName,
    description: draft.description.trim(),
    prefix: draft.prefix,
    assignee: draft.assignee,
    updated: 'just now',
    tasks: draft.tasks
      .filter((task) => task.title.trim())
      .map(({ dueAmount, dueUnit, ...task }) => ({
        ...task,
        title: task.title.trim(),
        group: task.group.trim() || 'default',
        description: task.description.trim(),
        dueInHours: hoursFromDue(dueAmount, dueUnit),
      })),
    customFields: draft.customFields
      .filter((field) => field.label.trim())
      .map((field) => ({
        ...field,
        label: field.label.trim(),
        key:
          field.key ||
          field.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/(^_|_$)/g, ''),
      })),
  }
}

export function CaseTemplateEditorPage({ templateId }: { templateId: string }) {
  const isNew = templateId === 'new'
  const {
    data: sourceTemplate,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery(caseTemplateQueryOptions(templateId))
  const [draft, setDraft] = useState<DraftTemplate>(() => newDraft())
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isNew) {
      setDraft(newDraft())
      return
    }

    if (sourceTemplate) setDraft(toDraft(sourceTemplate))
  }, [isNew, sourceTemplate, templateId])

  const title = isNew ? 'New template' : 'Edit template'
  const stamp = isNew
    ? 'create a reusable case skeleton'
    : draft.builtin
      ? 'built-in template · changes save as an org override'
      : 'backend template'

  const invalidateTemplates = () =>
    queryClient.invalidateQueries({ queryKey: caseTemplateKeys.all })

  const saveMutation = useMutation({
    mutationFn: (template: CaseTemplate) =>
      isNew ? createCaseTemplate(template) : updateCaseTemplate(template),
    onSuccess: () => {
      invalidateTemplates()
      notifications.show({ color: 'green', message: 'Template saved' })
      void navigate({ to: '/case-templates' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to save template',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteCaseTemplate(draft.id),
    onSuccess: () => {
      invalidateTemplates()
      notifications.show({ message: 'Template deleted' })
      void navigate({ to: '/case-templates' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to delete template',
      }),
  })

  const saveTemplate = () => {
    if (!draft.name.trim()) {
      notifications.show({ color: 'red', message: 'Display name is required' })
      return
    }

    const saved = toSavedTemplate(draft)
    saveMutation.mutate(saved)
  }

  const exportJson = async () => {
    const payload = isNew
      ? toSavedTemplate(draft)
      : await exportCaseTemplate(draft.id)
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    notifications.show({ message: 'Template JSON copied' })
  }

  if (!isNew && isPending) {
    return (
      <Box className={classes.page} maw={1080} mx="auto">
        <Paper radius="md" p="xl" shadow="xs">
          <Group justify="center" gap="xs">
            <Loader size="sm" />
            <Text c="dimmed">Loading case template…</Text>
          </Group>
        </Paper>
      </Box>
    )
  }

  if (!isNew && isError) {
    return (
      <Box className={classes.page} maw={1080} mx="auto">
        <Paper radius="md" p="xl" shadow="xs">
          <Stack align="center" gap="sm">
            <Text c="red.7">Couldn’t load this case template.</Text>
            <Button
              variant="default"
              loading={isFetching}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </Stack>
        </Paper>
      </Box>
    )
  }

  return (
    <Box className={classes.page} maw={1080} mx="auto">
      <Group gap={8} mb="md">
        <Button
          component={Link}
          to="/case-templates"
          variant="transparent"
          color="gray"
          p={0}
          h="auto"
        >
          ← Case templates
        </Button>
        <Text c="dimmed">/</Text>
        <Text ff="monospace" fz="xs" c="dimmed">
          {draft.name || 'New'}
        </Text>
      </Group>

      <Group align="center" justify="space-between" mb="lg" wrap="nowrap">
        <Group gap="md" align="baseline">
          <Title order={1}>{title}</Title>
          <Text ff="monospace" fz="xs" c="dimmed">
            {stamp}
          </Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Button component={Link} to="/case-templates" variant="default">
            Cancel
          </Button>
          <Button variant="default" onClick={() => void exportJson()}>
            Export JSON
          </Button>
          <Button
            color="orange"
            loading={saveMutation.isPending}
            onClick={saveTemplate}
          >
            Save template
          </Button>
        </Group>
      </Group>

      <Stack gap="md">
        <Panel title="Basics">
          <Stack p="lg">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Display name"
                aria-label="Display name"
                required
                value={draft.name}
                onChange={(event) => {
                  const name = event.currentTarget.value
                  setDraft((current) => ({
                    ...current,
                    name,
                    slug: current.slug || toSlug(name),
                  }))
                }}
              />
              <TextInput
                label="Slug / id"
                aria-label="Slug / id"
                value={draft.slug ?? draft.id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slug: toSlug(event.currentTarget.value),
                  }))
                }
                disabled={!isNew}
                description="used in alert imports and API calls"
              />
            </SimpleGrid>
            <Textarea
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
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Case title prefix"
                value={draft.prefix}
                placeholder="[Phishing]"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    prefix: event.currentTarget.value,
                  }))
                }
                description="prepended to case title on creation"
              />
              <Select
                label="Default assignee"
                data={assigneeOptions}
                value={draft.assignee}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, assignee: value ?? '' }))
                }
              />
            </SimpleGrid>
          </Stack>
        </Panel>

        <Panel title="Defaults" badge="applied to new cases">
          <Stack p="lg">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Box>
                <TemplateSegmentedControl
                  label="Severity"
                  options={severityOptions}
                  value={draft.sev}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      sev: value,
                    }))
                  }
                />
                <Text c="dimmed" size="xs" mt={4}>
                  {severityTemplateLabel(draft.sev)}
                </Text>
              </Box>
              <Box>
                <TemplateSegmentedControl
                  label="TLP"
                  options={trafficOptions}
                  value={draft.tlp}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      tlp: value,
                    }))
                  }
                />
                <Text c="dimmed" size="xs" mt={4}>
                  TLP:{trafficTemplateLabel(draft.tlp)}
                </Text>
              </Box>
              <Box>
                <TemplateSegmentedControl
                  label="PAP"
                  options={trafficOptions}
                  value={draft.pap}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      pap: value,
                    }))
                  }
                />
                <Text c="dimmed" size="xs" mt={4}>
                  PAP:{trafficTemplateLabel(draft.pap)}
                </Text>
              </Box>
            </SimpleGrid>
            <TextInput
              label="Default tags"
              value={tagsToText(draft.tags)}
              placeholder="type a tag and press Enter... (MITRE T-codes auto-style)"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tags: textToTags(event.currentTarget.value),
                }))
              }
            />
          </Stack>
        </Panel>

        <Panel
          title="Tasks"
          badge={draft.tasks.length}
          action={
            <Button
              variant="default"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  tasks: [
                    ...current.tasks,
                    {
                      title: 'New template task',
                      group: 'Triage',
                      description: '',
                      assignee: '',
                      dueInHours: 1,
                      flagged: false,
                      dueAmount: '1',
                      dueUnit: 'hours',
                    },
                  ],
                }))
              }
            >
              + Add task
            </Button>
          }
        >
          <Stack p="lg">
            {draft.tasks.length ? (
              draft.tasks.map((task, index) => (
                <TaskEditor
                  key={`${index}-${task.title}`}
                  task={task}
                  index={index}
                  onUpdate={(patch) =>
                    setDraft((current) => ({
                      ...current,
                      tasks: updateTask(current.tasks, index, patch),
                    }))
                  }
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      tasks: current.tasks.filter(
                        (_, taskIndex) => taskIndex !== index,
                      ),
                    }))
                  }
                  onMove={(direction) =>
                    setDraft((current) => ({
                      ...current,
                      tasks: moveTask(current.tasks, index, direction),
                    }))
                  }
                />
              ))
            ) : (
              <Paper withBorder radius="md" p="xl" ta="center">
                <Text c="dimmed">
                  No tasks yet. Click + Add task to define the playbook steps.
                </Text>
              </Paper>
            )}
          </Stack>
        </Panel>

        <Panel
          title="Custom fields"
          badge={draft.customFields.length}
          action={
            <Button
              variant="default"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  customFields: [
                    ...current.customFields,
                    {
                      key: '',
                      label: '',
                      type: 'string',
                      defaultValue: '',
                    },
                  ],
                }))
              }
            >
              + Add field
            </Button>
          }
        >
          <Stack p="lg">
            {draft.customFields.length ? (
              draft.customFields.map((field, index) => (
                <CustomFieldEditor
                  key={`${index}-${field.key}`}
                  field={field}
                  index={index}
                  onUpdate={(patch) =>
                    setDraft((current) => ({
                      ...current,
                      customFields: current.customFields.map(
                        (item, itemIndex) =>
                          itemIndex === index ? { ...item, ...patch } : item,
                      ),
                    }))
                  }
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      customFields: current.customFields.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                />
              ))
            ) : (
              <Paper withBorder radius="md" p="xl" ta="center">
                <Text c="dimmed">
                  No custom fields. Add typed metadata (e.g. Affected users,
                  Campaign ID) that analysts fill on the case.
                </Text>
              </Paper>
            )}
          </Stack>
        </Panel>

        <Group justify="space-between" mt="sm">
          <Button
            variant="default"
            color="red"
            disabled={draft.builtin || isNew}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete template
          </Button>
          <Group gap="sm">
            <Button component={Link} to="/case-templates" variant="default">
              Cancel
            </Button>
            <Button
              color="orange"
              loading={saveMutation.isPending}
              onClick={saveTemplate}
            >
              Save template
            </Button>
          </Group>
        </Group>
      </Stack>
    </Box>
  )
}
