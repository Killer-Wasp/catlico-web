import {
  Badge,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  Stack,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { DataTable } from '#/components/Table/DataTable'
import {
  createObservableType,
  deleteObservableType,
  observableTypesQueryOptions,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import type { ObservableTypePublic } from '#/components/pages/settings/settingsQueries'
import { LoadingPanel, Panel } from '#/components/pages/settings/settingsUi'

function AddTypeModal({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isAttachment, setIsAttachment] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      createObservableType({ name: name.trim(), is_attachment: isAttachment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'Observable type created' })
      setName('')
      setIsAttachment(false)
      onClose()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create observable type',
      }),
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Add observable type">
      <Stack gap="md">
        <TextInput
          label="Type name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Checkbox
          label="Attachment type"
          checked={isAttachment}
          onChange={(e) => setIsAttachment(e.currentTarget.checked)}
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
            Create type
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function ObservableTypesPanel() {
  const queryClient = useQueryClient()
  const { data: types = [], isPending } = useQuery(
    observableTypesQueryOptions(),
  )
  const [addOpen, setAddOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteObservableType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ message: 'Observable type deleted' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to delete observable type',
      }),
  })

  const columns = useMemo<ColumnDef<ObservableTypePublic>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => <Badge variant="default">{row.original.name}</Badge>,
      },
      {
        id: 'kind',
        header: 'Kind',
        cell: ({ row }) => (
          <Code>{row.original.is_attachment ? 'attachment' : 'value'}</Code>
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
            onClick={() => deleteMutation.mutate(row.original.name)}
          >
            Delete
          </Button>
        ),
      },
    ],
    [deleteMutation],
  )

  if (isPending) return <LoadingPanel label="Loading observable types..." />

  return (
    <>
      <AddTypeModal opened={addOpen} onClose={() => setAddOpen(false)} />
      <Panel
        title="Observable types"
        count={types.length}
        action={
          <Button variant="default" onClick={() => setAddOpen(true)}>
            + Add type
          </Button>
        }
      >
        <ObservableTypesTable columns={columns} types={types} />
      </Panel>
    </>
  )
}

function ObservableTypesTable({
  columns,
  types,
}: {
  columns: ColumnDef<ObservableTypePublic>[]
  types: ObservableTypePublic[]
}) {
  const table = useReactTable({
    data: types,
    columns,
    getRowId: (row) => row.name,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={520}
      ariaLabel="Observable types"
      emptyMessage="No observable types configured."
    />
  )
}
