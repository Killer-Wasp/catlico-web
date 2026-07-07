import {
  Badge,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  createCustomField,
  customFieldsQueryOptions,
  deleteCustomField,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import type {
  CustomFieldCreateInput,
  CustomFieldPublic,
} from '#/components/pages/settings/settingsQueries'
import { LoadingPanel, Panel } from '#/components/pages/settings/settingsUi'

const FIELD_TYPES = [
  { value: 'string', label: 'string' },
  { value: 'integer', label: 'integer' },
  { value: 'float', label: 'float' },
  { value: 'boolean', label: 'boolean' },
  { value: 'date', label: 'date' },
] as const

function AddFieldModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [fieldType, setFieldType] =
    useState<CustomFieldCreateInput['field_type']>('string')
  const [mandatory, setMandatory] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      createCustomField({
        name: name.trim(),
        display_name: displayName.trim() || name.trim(),
        description: description.trim(),
        field_type: fieldType,
        options: [],
        mandatory,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Custom field created' })
      setName('')
      setDisplayName('')
      setDescription('')
      setFieldType('string')
      setMandatory(false)
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create custom field',
      }),
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Add custom field">
      <Stack gap="md">
        <TextInput
          label="Key (name)"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
        />
        <TextInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Type"
          data={FIELD_TYPES}
          value={fieldType}
          onChange={(v) =>
            setFieldType(
              (v as CustomFieldCreateInput['field_type']) ?? 'string',
            )
          }
          allowDeselect={false}
        />
        <Checkbox
          label="Mandatory"
          checked={mandatory}
          onChange={(e) => setMandatory(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={mutation.isPending}
            disabled={!name.trim()}
            onClick={() => mutation.mutate()}
          >
            Create field
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function CustomFieldsPanel() {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery(customFieldsQueryOptions())
  const deleteMutation = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ message: 'Custom field deleted' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to delete custom field',
      }),
  })
  const [addOpen, setAddOpen] = useState(false)
  const fields = data?.fields ?? []

  const columns = useMemo<ColumnDef<CustomFieldPublic>[]>(
    () => [
      {
        id: 'label',
        header: 'Label',
        cell: ({ row }) => (
          <Text fw={700}>{row.original.display_name || row.original.name}</Text>
        ),
      },
      {
        id: 'key',
        header: 'Key',
        cell: ({ row }) => <Code>{row.original.name}</Code>,
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant="default">{row.original.field_type}</Badge>
        ),
      },
      {
        id: 'mandatory',
        header: 'Mandatory',
        cell: ({ row }) => (
          <Text c={row.original.mandatory ? 'yellow.7' : 'dimmed'}>
            {row.original.mandatory ? 'required' : 'optional'}
          </Text>
        ),
      },
      {
        id: 'multi',
        header: 'Multi-value',
        cell: ({ row }) => (row.original.options.length ? 'yes' : 'no'),
      },
      {
        id: 'usedBy',
        header: 'Used by',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {row.original.organisation_id}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => (
          <Button
            size="xs"
            variant="default"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(row.original.id)}
          >
            Delete
          </Button>
        ),
      },
    ],
    [deleteMutation],
  )

  if (isPending) return <LoadingPanel label="Loading custom fields..." />

  return (
    <>
      <AddFieldModal opened={addOpen} onClose={() => setAddOpen(false)} />
      <Panel
        title="Custom field definitions"
        count={fields.length}
        action={
          <Button variant="default" onClick={() => setAddOpen(true)}>
            + Add field
          </Button>
        }
      >
        <CustomFieldsTable columns={columns} fields={fields} />
      </Panel>
    </>
  )
}

function CustomFieldsTable({
  columns,
  fields,
}: {
  columns: ColumnDef<CustomFieldPublic>[]
  fields: CustomFieldPublic[]
}) {
  const table = useReactTable({
    data: fields,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={820}
      ariaLabel="Custom field definitions"
      emptyMessage="No custom fields configured."
    />
  )
}
