import classes from '#/components/Cases/CasesPage.module.css'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
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
import { CustomFieldsTable } from './case-template-editor/CustomFieldsTable'
import { downloadJsonFile } from './case-template-editor/downloadJsonFile'
import {
  moveTask,
  newDraft,
  newDraftTask,
  toDraft,
  toSavedTemplate,
  toSlug,
  updateTask,
} from './case-template-editor/draft'
import type { DraftTemplate } from './case-template-editor/draft'
import {
  assigneeOptions,
  severityOptions,
  trafficOptions,
} from './case-template-editor/options'
import { Panel } from './case-template-editor/Panel'
import { RichTextField } from './case-template-editor/RichTextField'
import { TemplateSelect } from './case-template-editor/TemplateSelect'
import { TemplateTagsInput } from './case-template-editor/TemplateTagsInput'
import {
  TaskFormModal,
  TaskTemplatesTable,
} from './case-template-editor/TaskTemplatesTable'
import { arrayMove } from '@dnd-kit/sortable'
import {
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
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

type TaskModalState =
  | { mode: 'create' }
  | { mode: 'edit'; index: number }
  | null

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
  const [taskModal, setTaskModal] = useState<TaskModalState>(null)
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
      notifications.show({
        color: 'red',
        message: 'Case Template Name is required',
      })
      return
    }

    saveMutation.mutate(toSavedTemplate(draft))
  }

  const exportJson = async () => {
    const payload = isNew
      ? toSavedTemplate(draft)
      : await exportCaseTemplate(draft.id)
    const filename = `${toSlug(payload.name || draft.slug || draft.name) || 'case-template'}.json`
    downloadJsonFile(payload, filename)
    notifications.show({ message: 'Template JSON downloaded' })
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
            <Box
              data-testid="template-name-id-row"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 3fr)',
                gap: 'var(--mantine-spacing-md)',
                alignItems: 'start',
              }}
            >
              <TextInput
                label="Case Template Name"
                aria-label="Case Template Name"
                required
                value={draft.name}
                onChange={(event) => {
                  const name = event.currentTarget.value
                  setDraft((current) => ({ ...current, name }))
                }}
              />
              <TextInput
                label="Id"
                aria-label="Id"
                required
                placeholder="e.g. phishing-investigation"
                autoComplete="off"
                value={draft.slug ?? draft.id}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setDraft((current) => ({
                    ...current,
                    slug: toSlug(value),
                  }))
                }}
                disabled={!isNew}
                description="used in alert imports and API calls"
              />
            </Box>
            <TextInput
              label="Case Template Description"
              value={draft.summary ?? ''}
              maxLength={255}
              onChange={(event) => {
                const summary = event.currentTarget.value.slice(0, 255)
                setDraft((current) => ({
                  ...current,
                  summary,
                }))
              }}
              description={`${(draft.summary ?? '').length}/255`}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Case title prefix"
                value={draft.prefix}
                placeholder="[Phishing]"
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setDraft((current) => ({
                    ...current,
                    prefix: value,
                  }))
                }}
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
            <RichTextField
              label="Body"
              value={draft.description}
              onChange={(description) =>
                setDraft((current) => ({
                  ...current,
                  description,
                }))
              }
            />
          </Stack>
        </Panel>

        <Panel title="Defaults" badge="applied to new cases">
          <Stack p="lg">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <Box>
                <TemplateSelect
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
                <TemplateSelect
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
                <TemplateSelect
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
            <TemplateTagsInput
              value={draft.tags}
              onChange={(tags) =>
                setDraft((current) => ({
                  ...current,
                  tags,
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
              onClick={() => setTaskModal({ mode: 'create' })}
            >
              + Add task
            </Button>
          }
        >
          <Stack p="lg">
            {draft.tasks.length ? (
              <TaskTemplatesTable
                tasks={draft.tasks}
                onEdit={(index) => setTaskModal({ mode: 'edit', index })}
                onRemove={(index) =>
                  setDraft((current) => ({
                    ...current,
                    tasks: current.tasks.filter(
                      (_, taskIndex) => taskIndex !== index,
                    ),
                  }))
                }
                onReorder={(oldIndex, newIndex) =>
                  setDraft((current) => ({
                    ...current,
                    tasks: arrayMove(current.tasks, oldIndex, newIndex),
                  }))
                }
              />
            ) : (
              <Paper withBorder radius="md" p="xl" ta="center">
                <Text c="dimmed">
                  No tasks yet. Click + Add task to define the playbook steps.
                </Text>
              </Paper>
            )}
          </Stack>
        </Panel>

        {taskModal ? (
          <TaskFormModal
            mode={taskModal.mode}
            initialTask={
              taskModal.mode === 'edit'
                ? draft.tasks[taskModal.index]
                : newDraftTask()
            }
            canMoveUp={taskModal.mode === 'edit' && taskModal.index > 0}
            canMoveDown={
              taskModal.mode === 'edit' &&
              taskModal.index < draft.tasks.length - 1
            }
            onClose={() => setTaskModal(null)}
            onSave={(task) => {
              setDraft((current) => ({
                ...current,
                tasks:
                  taskModal.mode === 'edit'
                    ? updateTask(current.tasks, taskModal.index, task)
                    : [...current.tasks, task],
              }))
              setTaskModal(null)
            }}
            onMove={(direction) => {
              if (taskModal.mode !== 'edit') return
              const nextIndex = taskModal.index + direction
              setDraft((current) => ({
                ...current,
                tasks: moveTask(current.tasks, taskModal.index, direction),
              }))
              setTaskModal({ mode: 'edit', index: nextIndex })
            }}
          />
        ) : null}

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
              <CustomFieldsTable
                fields={draft.customFields}
                onUpdate={(index, patch) =>
                  setDraft((current) => ({
                    ...current,
                    customFields: current.customFields.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ...patch } : item,
                    ),
                  }))
                }
                onRemove={(index) =>
                  setDraft((current) => ({
                    ...current,
                    customFields: current.customFields.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              />
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
