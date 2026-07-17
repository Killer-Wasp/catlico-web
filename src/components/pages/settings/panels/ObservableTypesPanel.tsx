import {
  Badge,
  Button,
  Checkbox,
  Code,
  Stack,
  TextInput,
} from '@mantine/core'
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
import {
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'
import { FormDrawer } from '#/components/ui/FormDrawer'
import { usePermissions } from '#/lib/auth/usePermissions'

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
      queryClient.invalidateQueries({
        queryKey: settingsKeys.observableTypes(),
      })
      notifySuccess('Observable type created')
      setName('')
      setIsAttachment(false)
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to create observable type'),
  })

  return (
    <FormDrawer
      opened={opened}
      onClose={onClose}
      title="Add observable type"
      submitLabel="Create type"
      loading={mutation.isPending}
      submitDisabled={!name.trim()}
      onSubmit={() => mutation.mutate()}
    >
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
      </Stack>
    </FormDrawer>
  )
}

export function ObservableTypesPanel() {
  const queryClient = useQueryClient()
  // Observable-type create/delete are platform-admin only (SuperAdminUser on the API).
  const { isSuperadmin } = usePermissions()
  const {
    data: types = [],
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(observableTypesQueryOptions())
  const [addOpen, setAddOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteObservableType,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsKeys.observableTypes(),
      })
      notifySuccess('Observable type deleted')
    },
    onError: (error) => notifyError(error, 'Unable to delete observable type'),
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
        cell: ({ row }) =>
          isSuperadmin ? (
            <Button
              size="xs"
              variant="default"
              color="red"
              loading={
                deleteMutation.isPending &&
                deleteMutation.variables === row.original.name
              }
              onClick={() =>
                confirmDelete({
                  title: 'Delete observable type',
                  message: `Delete the "${row.original.name}" observable type? Observables already using it may be affected.`,
                  onConfirm: () => deleteMutation.mutate(row.original.name),
                })
              }
            >
              Delete
            </Button>
          ) : null,
      },
    ],
    [deleteMutation, isSuperadmin],
  )

  if (isPending) return <LoadingPanel label="Loading observable types..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn't load observable types."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )
  }

  return (
    <>
      <AddTypeModal opened={addOpen} onClose={() => setAddOpen(false)} />
      <Panel
        title="Observable types"
        count={types.length}
        action={
          isSuperadmin ? (
            <Button variant="default" onClick={() => setAddOpen(true)}>
              + Add type
            </Button>
          ) : undefined
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
