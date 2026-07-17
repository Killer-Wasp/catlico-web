import {
  Button,
  Code,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import { FormDrawer } from '#/components/ui/FormDrawer'
import {
  createReportTemplate,
  deleteReportTemplate,
  reportTemplatesQueryOptions,
  settingsKeys,
  updateReportTemplate,
} from '#/components/pages/settings/settingsQueries'
import type { ReportTemplatePublic } from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'
import { usePermissions } from '#/lib/auth/usePermissions'

const reportTemplatesKeyPrefix = [...settingsKeys.all, 'report-templates']

// Short, copy-pasteable cheat-sheet for the placeholder syntax. The server owns
// rendering — this is purely help text so authors know what they can reference.
function PlaceholderHelp() {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        Placeholder syntax
      </Text>
      <Text size="xs" c="dimmed">
        Scalars: <Code>{'{{ title }}'}</Code>, <Code>{'{{ severity }}'}</Code>,{' '}
        <Code>{'{{ timeline_summary }}'}</Code>
      </Text>
      <Text size="xs" c="dimmed">
        Observables:{' '}
        <Code>{'{{#observables}} {{type}} {{value}} {{/observables}}'}</Code>
      </Text>
      <Text size="xs" c="dimmed">
        Tasks: <Code>{'{{#tasks}} {{title}} {{status}} {{/tasks}}'}</Code>
      </Text>
    </Stack>
  )
}

function TemplateModal({
  opened,
  template,
  onClose,
}: {
  opened: boolean
  template: ReportTemplatePublic | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [contentMd, setContentMd] = useState('')

  // Re-seed the form each time the modal opens (create → blank, edit → values).
  useEffect(() => {
    if (!opened) return
    setName(template?.name ?? '')
    setDescription(template?.description ?? '')
    setContentMd(template?.content_md ?? '')
  }, [opened, template])

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim(),
        content_md: contentMd,
      }
      return template
        ? updateReportTemplate(template.id, body)
        : createReportTemplate(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportTemplatesKeyPrefix })
      notifySuccess(template ? 'Template updated' : 'Template created')
      onClose()
    },
    onError: (error) =>
      notifyError(
        error,
        template ? 'Unable to update template' : 'Unable to create template',
      ),
  })

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title={template ? `Edit ${template.name}` : 'New report template'}
      size="lg"
      submitLabel={template ? 'Save changes' : 'Create template'}
      loading={mutation.isPending}
      submitDisabled={!name.trim()}
      onSubmit={() => mutation.mutate()}
    >
      <Stack gap="md">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Incident summary"
          required
        />
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          placeholder="Shown in the report picker"
        />
        <Textarea
          label="Template (Markdown)"
          value={contentMd}
          onChange={(e) => setContentMd(e.currentTarget.value)}
          rows={10}
          styles={{ input: { fontFamily: 'monospace' } }}
          placeholder={'# {{ title }}\n\n{{ timeline_summary }}'}
        />
        <PlaceholderHelp />
      </Stack>
    </FormDrawer>
  )
}

export function ReportTemplatesPanel() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canWrite = can('write:organisation')
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    reportTemplatesQueryOptions(),
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReportTemplatePublic | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteReportTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportTemplatesKeyPrefix })
      notifySuccess('Template deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete template'),
  })

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (template: ReportTemplatePublic) => {
    setEditing(template)
    setModalOpen(true)
  }

  const columns = useMemo<ColumnDef<ReportTemplatePublic>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        cell: ({ row }) => <Text fw={700}>{row.original.name}</Text>,
      },
      {
        id: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <Text c={row.original.description ? undefined : 'dimmed'}>
            {row.original.description || '—'}
          </Text>
        ),
      },
      {
        id: 'updated',
        header: 'Updated',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {compactDate(row.original.updated_at ?? row.original.created_at)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) =>
          canWrite ? (
            <Group gap="xs" justify="flex-end">
              <Button
                size="xs"
                variant="default"
                onClick={() => openEdit(row.original)}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="default"
                color="red"
                loading={
                  deleteMutation.isPending &&
                  deleteMutation.variables === row.original.id
                }
                onClick={() =>
                  confirmDelete({
                    title: 'Delete report template',
                    message: `Delete "${row.original.name}"? Cases can no longer be exported with it.`,
                    confirmLabel: 'Delete template',
                    onConfirm: () => deleteMutation.mutate(row.original.id),
                  })
                }
              >
                Delete
              </Button>
            </Group>
          ) : null,
      },
    ],
    [deleteMutation, canWrite],
  )

  if (isPending) return <LoadingPanel label="Loading report templates..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load report templates."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  const templates = data

  return (
    <>
      <TemplateModal
        opened={modalOpen}
        template={editing}
        onClose={() => setModalOpen(false)}
      />
      <Panel
        title="Report templates"
        count={templates.length}
        action={
          canWrite ? (
            <Button variant="default" onClick={openCreate}>
              + New template
            </Button>
          ) : undefined
        }
      >
        <ReportTemplatesTable columns={columns} templates={templates} />
      </Panel>
    </>
  )
}

function ReportTemplatesTable({
  columns,
  templates,
}: {
  columns: ColumnDef<ReportTemplatePublic>[]
  templates: ReportTemplatePublic[]
}) {
  const table = useReactTable({
    data: templates,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={640}
      ariaLabel="Report templates"
      emptyMessage="No report templates yet."
    />
  )
}
