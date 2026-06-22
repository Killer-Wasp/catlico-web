import { AV } from '#/components/Cases/cases'
import { formatTemplateDue } from '#/components/Cases/caseTemplates'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import type {
  CaseTemplateTask,
  CustomFieldType,
  NewCaseCustomField,
} from '#/components/Cases/caseTemplates.types'
import {
  caseKeys,
  createCaseFromTemplate,
} from '#/components/Cases/casesQueries'
import type { Pap } from '#/lib/domain'
import classes from '#/components/Cases/CasesPage.module.css'
import {
  Anchor,
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Hourglass, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type TrafficLight = 0 | 1 | 2 | 3
type SeverityChoice = 1 | 2 | 3 | 4

const businessUnits = [
  'Corporate IT',
  'Retail',
  'Energy Markets',
  'Generation / OT',
  'Digital',
]

const severityChoices: {
  value: SeverityChoice
  label: string
  color: string
}[] = [
  { value: 1, label: 'LOW', color: 'var(--sev-low)' },
  { value: 2, label: 'MEDIUM', color: 'var(--sev-medium)' },
  { value: 3, label: 'HIGH', color: 'var(--sev-high)' },
  { value: 4, label: 'CRITICAL', color: 'var(--sev-critical)' },
]

const trafficChoices: {
  value: TrafficLight
  label: string
  color: string
}[] = [
  { value: 0, label: 'WHITE', color: 'var(--tlp-white)' },
  { value: 1, label: 'GREEN', color: 'var(--tlp-green)' },
  { value: 2, label: 'AMBER', color: 'var(--tlp-amber)' },
  { value: 3, label: 'RED', color: 'var(--tlp-red)' },
]

const fieldLblProps = {
  fz: 12,
  c: 'var(--muted)',
  fw: 600,
} as const

const monoMetaProps = {
  ff: 'monospace',
  fz: 10.5,
  c: 'var(--faint)',
} as const

function RequiredMark() {
  return (
    <Text component="span" c="var(--sev-critical)" inherit>
      {' '}
      *
    </Text>
  )
}

function FieldLabel({
  children,
  required,
}: {
  children: string
  required?: boolean
}) {
  return (
    <Text component="span" {...fieldLblProps}>
      {children}
      {required && <RequiredMark />}
    </Text>
  )
}

function choiceStyle(active: boolean, color: string) {
  return active
    ? {
        color,
        borderColor: color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }
    : undefined
}

function SegmentedButtons<T extends number>({
  label,
  choices,
  value,
  onChange,
  required,
}: {
  label: string
  choices: { value: T; label: string; color: string }[]
  value: T
  onChange: (value: T) => void
  required?: boolean
}) {
  return (
    <Stack gap={6}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Group gap={6} role="radiogroup" aria-label={label}>
        {choices.map((choice) => {
          const active = choice.value === value
          return (
            <Button
              key={choice.value}
              type="button"
              size="xs"
              variant="default"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(choice.value)}
              ff="monospace"
              fz={11}
              lts="0.4px"
              fw={700}
              style={choiceStyle(active, choice.color)}
            >
              {choice.label}
            </Button>
          )
        })}
      </Group>
    </Stack>
  )
}

function CustomFieldInput({
  type,
  label,
  value,
  error,
  onChange,
  mandatory,
}: {
  type: CustomFieldType
  label: string
  value: string
  error: boolean
  onChange: (value: string) => void
  mandatory: boolean
}) {
  const inputProps = {
    label: <FieldLabel required={mandatory}>{label}</FieldLabel>,
    error: error ? 'Required' : undefined,
  }

  if (type === 'integer' || type === 'float') {
    return (
      <NumberInput
        {...inputProps}
        placeholder={type}
        value={value === '' ? undefined : Number(value)}
        allowDecimal={type === 'float'}
        onChange={(next) => onChange(next === '' ? '' : String(next))}
      />
    )
  }

  if (type === 'boolean') {
    return (
      <Select
        {...inputProps}
        placeholder="—"
        data={['yes', 'no']}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
      />
    )
  }

  return (
    <TextInput
      {...inputProps}
      type={type === 'date' ? 'date' : 'text'}
      placeholder={type}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

function TaskTemplateRow({ task }: { task: CaseTemplateTask }) {
  return (
    <Group
      gap={12}
      wrap="nowrap"
      py={10}
      style={{
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <Checkbox size="xs" readOnly aria-label={`Template task ${task.title}`} />
      <Box flex={1} miw={0}>
        <Group gap={5} wrap="nowrap">
          <Text fw={600} fz={13} truncate>
            {task.title}
          </Text>
          {task.flagged && (
            <TriangleAlert
              size={13}
              aria-label="Flagged task"
              style={{ color: 'var(--sev-medium)', flexShrink: 0 }}
            />
          )}
        </Group>
        <Text {...monoMetaProps} truncate>
          {[
            task.group,
            task.assignee,
            task.description ? 'has description' : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      <Text
        component="span"
        ff="monospace"
        fz={10.5}
        c="var(--muted)"
        bg="gray.0"
        px={8}
        py={3}
        style={{ borderRadius: 4, whiteSpace: 'nowrap' }}
      >
        <Hourglass size={11} style={{ verticalAlign: '-1px' }} />{' '}
        {formatTemplateDue(task.dueInHours)}
      </Text>
      <Text
        component="span"
        ff="monospace"
        fz={10}
        fw={700}
        c="var(--muted)"
        bg="gray.0"
        px={8}
        py={3}
        style={{ borderRadius: 99, whiteSpace: 'nowrap' }}
      >
        WAITING
      </Text>
    </Group>
  )
}

export function CreateCasePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: templatesResult, isPending: templatesPending } = useQuery(
    caseTemplatesQueryOptions(),
  )
  const templates = templatesResult?.templates ?? []

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const [businessUnit, setBusinessUnit] = useState('Corporate IT')
  const [severity, setSeverity] = useState<SeverityChoice>(2)
  const [tlp, setTlp] = useState<TrafficLight>(2)
  const [pap, setPap] = useState<Pap>(2)
  const [tags, setTags] = useState<string[]>([])
  const [customValues, setCustomValues] = useState<
    Record<string, string | undefined>
  >({})
  const [submitted, setSubmitted] = useState(false)

  const template = useMemo(
    () => templates.find((item) => item.id === templateId),
    [templateId, templates],
  )
  const customFields = useMemo<NewCaseCustomField[]>(
    () =>
      (template?.customFields ?? []).map((field) => ({
        ...field,
        mandatory: false,
      })),
    [template],
  )

  useEffect(() => {
    if (templateId || templates.length === 0) return

    const first = templates[0]
    setTemplateId(first.id)
    setSeverity(first.sev)
    setTlp(first.tlp)
    setPap(first.pap)
    if (first.assignee) setAssignee(first.assignee)
    setTags(first.tags)
    setCustomValues(
      Object.fromEntries(
        first.customFields.map((field) => [field.key, field.defaultValue]),
      ),
    )
  }, [templateId, templates])

  const createMutation = useMutation({
    mutationFn: createCaseFromTemplate,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: caseKeys.all })
      notifications.show({
        color: 'teal',
        message: `Case created from ${template?.name ?? 'selected template'}`,
      })
      void navigate({
        to: '/cases/$caseId/$tab',
        params: { caseId: String(created.numericId), tab: 'details' },
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to create case',
      }),
  })

  const titleError = submitted && title.trim().length === 0
  const missingCustomFields = submitted
    ? new Set(
        customFields
          .filter(
            (field) =>
              field.mandatory && !customValues[field.key]?.trim().length,
          )
          .map((field) => field.key),
      )
    : new Set<string>()

  const applyTemplate = (nextTemplateId: string) => {
    const next = templates.find((item) => item.id === nextTemplateId)
    setTemplateId(nextTemplateId)
    if (!next) return

    setSeverity(next.sev)
    setTlp(next.tlp)
    setPap(next.pap)
    if (next.assignee) setAssignee(next.assignee)
    setTags(next.tags)
    setCustomValues(
      Object.fromEntries(
        next.customFields.map((field) => [field.key, field.defaultValue]),
      ),
    )
    setSubmitted(false)
  }

  const customFieldPayload = () =>
    Object.fromEntries(
      customFields
        .map((field) => {
          const raw = customValues[field.key] ?? field.defaultValue
          if (!raw.trim()) return [field.key, null]
          if (field.type === 'integer')
            return [field.key, Number.parseInt(raw, 10)]
          if (field.type === 'float') return [field.key, Number.parseFloat(raw)]
          if (field.type === 'boolean') return [field.key, raw === 'yes']
          return [field.key, raw]
        })
        .filter(([, value]) => value !== null),
    )

  const submit = () => {
    setSubmitted(true)
    const missing = customFields.filter(
      (field) => field.mandatory && !customValues[field.key]?.trim().length,
    )

    if (!title.trim()) {
      notifications.show({ color: 'red', message: 'A case title is required' })
      return
    }

    if (missing.length) {
      notifications.show({
        color: 'red',
        message: `Mandatory custom field${
          missing.length > 1 ? 's' : ''
        }: ${missing.map((field) => field.label).join(', ')}`,
      })
      return
    }

    const templateApiId =
      template?.apiId ?? (template?.id ? Number(template.id) : null)

    createMutation.mutate({
      title,
      description,
      severity,
      tlp,
      pap,
      caseTemplateId:
        typeof templateApiId === 'number' && Number.isFinite(templateApiId)
          ? templateApiId
          : null,
      tags,
      customFields: {
        business_unit: businessUnit,
        ...customFieldPayload(),
      },
    })
  }

  return (
    <Box className={classes.page}>
      <Box maw={980} mx="auto">
        <Group gap={8} mb={18} ff="monospace" fz={11} c="var(--muted)">
          <Button
            component={Link}
            to="/cases"
            variant="subtle"
            color="gray"
            size="compact-xs"
            leftSection={<ArrowLeft size={13} />}
            px={0}
          >
            Cases
          </Button>
          <Text component="span" c="var(--faint)">
            /
          </Text>
          <Text component="span">New case</Text>
        </Group>

        <Group align="baseline" gap={14} mb={20} wrap="wrap">
          <Title order={1} size="h2">
            Create case
          </Title>
          <Text component="span" ff="monospace" fz={11} c="var(--faint)">
            fields marked <RequiredMark /> are required
          </Text>
        </Group>

        <Paper radius="md" p={22} shadow="sm">
          <Stack gap={16}>
            <TextInput
              label={<FieldLabel required>Title</FieldLabel>}
              placeholder="e.g. Suspicious OAuth consent grant — corporate tenant"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              error={titleError ? 'Required' : undefined}
              data-autofocus
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
              <Box>
                <Select
                  label={<FieldLabel>Case template</FieldLabel>}
                  data={templates.map((caseTemplate) => ({
                    value: caseTemplate.id,
                    label: caseTemplate.name,
                  }))}
                  value={templateId || null}
                  onChange={(next) => {
                    if (next) applyTemplate(next)
                  }}
                  disabled={templatesPending || templates.length === 0}
                  placeholder={
                    templatesPending
                      ? 'Loading templates…'
                      : 'No templates found'
                  }
                  allowDeselect={false}
                />
                <Text {...monoMetaProps} mt={5}>
                  templates pre-load defaults, tags, tasks and custom fields ·{' '}
                  <Anchor
                    component="button"
                    type="button"
                    fz="inherit"
                    onClick={() => void navigate({ to: '/case-templates' })}
                  >
                    manage templates
                  </Anchor>
                </Text>
              </Box>

              <Select
                label={<FieldLabel>Assignee</FieldLabel>}
                data={Object.keys(AV)}
                value={assignee}
                onChange={(next) => setAssignee(next ?? 'Unassigned')}
                allowDeselect={false}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
              <SegmentedButtons
                label="Severity"
                choices={severityChoices}
                value={severity}
                onChange={setSeverity}
                required
              />

              <Select
                label={<FieldLabel>Business unit</FieldLabel>}
                data={businessUnits}
                value={businessUnit}
                onChange={(next) => setBusinessUnit(next ?? 'Corporate IT')}
                allowDeselect={false}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
              <SegmentedButtons
                label="TLP"
                choices={trafficChoices}
                value={tlp}
                onChange={setTlp}
              />

              <Box>
                <SegmentedButtons
                  label="PAP"
                  choices={trafficChoices}
                  value={pap}
                  onChange={setPap}
                />
                <Text {...monoMetaProps} mt={5}>
                  permissible actions protocol — how observables may be used
                </Text>
              </Box>
            </SimpleGrid>

            <TagsInput
              label={<FieldLabel>Tags</FieldLabel>}
              placeholder="type a tag and press Enter… (e.g. T1528, identity)"
              value={tags}
              onChange={setTags}
              clearable
            />

            <Textarea
              label={<FieldLabel>Description</FieldLabel>}
              placeholder="What happened, scope, working hypothesis… markdown supported"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              minRows={5}
            />

            {customFields.length > 0 && (
              <Box>
                <Group gap={8} mb={8}>
                  <FieldLabel>Custom fields</FieldLabel>
                  <Text {...monoMetaProps}>
                    from template ·{' '}
                    <Text component="span" c="var(--sev-critical)" inherit>
                      *
                    </Text>{' '}
                    mandatory
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
                  {customFields.map((field) => (
                    <CustomFieldInput
                      key={field.key}
                      type={field.type}
                      label={field.label}
                      mandatory={field.mandatory}
                      value={customValues[field.key] ?? field.defaultValue}
                      error={missingCustomFields.has(field.key)}
                      onChange={(next) =>
                        setCustomValues((current) => ({
                          ...current,
                          [field.key]: next,
                        }))
                      }
                    />
                  ))}
                </SimpleGrid>
              </Box>
            )}

            <Box>
              <FieldLabel>Tasks from template</FieldLabel>
              <Box
                mt={8}
                px={14}
                style={{
                  border: '1px dashed var(--line-soft)',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                {template?.tasks.length ? (
                  template.tasks.map((taskItem) => (
                    <TaskTemplateRow key={taskItem.title} task={taskItem} />
                  ))
                ) : (
                  <Text c="var(--faint)" fz={12} ta="center" py={18}>
                    no tasks defined on this template
                  </Text>
                )}
              </Box>
            </Box>

            <Group justify="flex-end" gap="sm" mt={4}>
              <Button component={Link} to="/cases" variant="default">
                Cancel
              </Button>
              <Button loading={createMutation.isPending} onClick={submit}>
                Create case
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}
