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
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

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
      queryClient.invalidateQueries({
        queryKey: [...settingsKeys.all, 'custom-fields'],
      })
      notifySuccess('Custom field created')
      setName('')
      setDisplayName('')
      setDescription('')
      setFieldType('string')
      setMandatory(false)
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create custom field'),
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
            setFieldType(v as CustomFieldCreateInput['field_type'])
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
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    customFieldsQueryOptions(),
  )
  const deleteMutation = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...settingsKeys.all, 'custom-fields'],
      })
      notifySuccess('Custom field deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete custom field'),
  })
  const [addOpen, setAddOpen] = useState(false)
  const fields = data?.fields ?? []
  const total = data?.total ?? fields.length
  // The list query is capped (DEFAULT_SETTINGS_FILTERS limit), so tell the user
  // when there are more definitions than we're showing rather than silently hiding.
  const truncated = total > fields.length

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
        id: 'dropdown',
        header: 'Dropdown',
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
            color="red"
            loading={
              deleteMutation.isPending &&
              deleteMutation.variables === row.original.id
            }
            onClick={() =>
              confirmDelete({
                title: 'Delete custom field',
                message: `Delete "${row.original.display_name || row.original.name}"? Values stored on existing cases and alerts will be removed.`,
                onConfirm: () => deleteMutation.mutate(row.original.id),
              })
            }
          >
            Delete
          </Button>
        ),
      },
    ],
    [deleteMutation],
  )

  if (isPending) return <LoadingPanel label="Loading custom fields..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load custom fields."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <>
      <AddFieldModal opened={addOpen} onClose={() => setAddOpen(false)} />
      <Panel
        title="Custom field definitions"
        count={total}
        action={
          <Button variant="default" onClick={() => setAddOpen(true)}>
            + Add field
          </Button>
        }
      >
        {truncated && (
          <Text c="dimmed" fz={12} px={18} pt={12}>
            Showing the first {fields.length} of {total} custom fields.
          </Text>
        )}
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
