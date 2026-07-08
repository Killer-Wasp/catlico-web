import { useAssigneeStringOptions } from '#/components/Assign/assigneeOptions'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import type { NewCaseCustomField } from '#/components/Cases/caseTemplates.types'
import {
  caseKeys,
  createCaseFromTemplate,
} from '#/components/Cases/casesQueries'
import type { Pap } from '#/lib/domain'
import classes from '#/components/Cases/CasesPage.module.css'
import { TagPickerInput } from '#/components/Tag/TagPickerInput'
import {
  Anchor,
  Box,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  BUSINESS_UNITS,
  SEVERITY_CHOICES,
  TRAFFIC_CHOICES,
} from './create-case/constants'
import type { SeverityChoice, TrafficLight } from './create-case/constants'
import styles from './create-case/styles.module.css'
import {
  CustomFieldInput,
  FieldLabel,
  RequiredMark,
  SegmentedButtons,
} from './create-case/Fields'
import { TaskTemplateRow } from './create-case/TaskTemplateRow'

export function CreateCasePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: templatesResult, isPending: templatesPending } = useQuery(
    caseTemplatesQueryOptions(),
  )
  const templates = templatesResult?.templates ?? []
  const tagSuggestions = useMemo(
    () => [...new Set(templates.flatMap((template) => template.tags))].sort(),
    [templates],
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [assignee, setAssignee] = useState('Unassigned')
  const assigneeOptions = useAssigneeStringOptions(assignee)
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
                <Text className={styles.metaText} mt={5}>
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
                data={assigneeOptions}
                value={assignee}
                onChange={(next) => setAssignee(next ?? 'Unassigned')}
                allowDeselect={false}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
              <SegmentedButtons
                label="Severity"
                choices={SEVERITY_CHOICES}
                value={severity}
                onChange={setSeverity}
                required
              />

              <Select
                label={<FieldLabel>Business unit</FieldLabel>}
                data={BUSINESS_UNITS}
                value={businessUnit}
                onChange={(next) => setBusinessUnit(next ?? 'Corporate IT')}
                allowDeselect={false}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={18}>
              <SegmentedButtons
                label="TLP"
                choices={TRAFFIC_CHOICES}
                value={tlp}
                onChange={setTlp}
              />

              <Box>
                <SegmentedButtons
                  label="PAP"
                  choices={TRAFFIC_CHOICES}
                  value={pap}
                  onChange={setPap}
                />
                <Text className={styles.metaText} mt={5}>
                  permissible actions protocol — how observables may be used
                </Text>
              </Box>
            </SimpleGrid>

            <TagPickerInput
              label={<FieldLabel>Tags</FieldLabel>}
              description="pick a suggested tag or type your own (MITRE T-codes auto-style)"
              placeholder="e.g. T1528, identity"
              suggestions={tagSuggestions}
              value={tags}
              onChange={setTags}
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
                  <Text className={styles.metaText}>
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
