import {
  ActionIcon,
  Button,
  Code,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { DataTable } from '#/components/Table/DataTable'
import type { ApiKeyPublic } from '#/components/pages/settings/settingsQueries'
import {
  apiKeysQueryOptions,
  createApiKey,
  revokeApiKey,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  LoadingPanel,
  Panel,
} from '#/components/pages/settings/settingsUi'

export function ApiKeysPanel() {
  const queryClient = useQueryClient()
  const {
    data: keys,
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(apiKeysQueryOptions())
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createApiKey({ name: newName }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      setNewKey(created.key)
      setNewName('')
      notifications.show({
        color: 'green',
        message: 'API key generated - save it now',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to create API key',
      }),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ message: 'API key revoked' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to revoke API key',
      }),
  })

  const columns = useMemo<ColumnDef<ApiKeyPublic>[]>(
    () => [
      { id: 'name', header: 'Label', accessorFn: (row) => row.name },
      {
        id: 'key',
        header: 'Key',
        cell: ({ row }) => (
          <Code>
            {row.original.prefix}...{row.original.last_four}
          </Code>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ row }) => (
          <Text ff="monospace" fz={11}>
            {row.original.scopes.join(', ') || '-'}
          </Text>
        ),
      },
      {
        id: 'lastUsed',
        header: 'Last used',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {compactDate(row.original.last_used_at)}
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
            loading={
              revokeMutation.isPending &&
              revokeMutation.variables === row.original.id
            }
            onClick={() => revokeMutation.mutate(row.original.id)}
          >
            Revoke
          </Button>
        ),
      },
    ],
    [revokeMutation],
  )

  if (isPending) return <LoadingPanel label="Loading API keys..." />

  if (isError) {
    return (
      <Panel title="API keys">
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load API keys.</Text>
          <Button
            variant="default"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Stack>
      </Panel>
    )
  }

  return (
    <>
      <Panel
        title="API keys"
        action={
          <Button
            variant="default"
            onClick={() => {
              setNewName('')
              setNewKey('')
              setShowCreate(true)
            }}
          >
            + Generate key
          </Button>
        }
      >
        <ApiKeysTable columns={columns} keys={keys} />
      </Panel>

      <Modal
        opened={showCreate}
        onClose={() => {
          setShowCreate(false)
          setNewKey('')
        }}
        title={newKey ? 'API key created' : 'Generate new API key'}
      >
        {newKey ? (
          <Stack>
            <Text size="sm">
              This API key will only be shown once. Copy it before closing this
              modal.
            </Text>
            <TextInput
              label="API key"
              value={newKey}
              disabled
              styles={{ input: { fontFamily: 'monospace' } }}
              rightSection={
                <ActionIcon
                  variant="subtle"
                  aria-label="Copy API key"
                  onClick={() => {
                    void navigator.clipboard.writeText(newKey)
                    notifications.show({ message: 'API key copied' })
                  }}
                >
                  <Copy size={16} />
                </ActionIcon>
              }
            />
          </Stack>
        ) : (
          <Stack>
            <TextInput
              label="Key name"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              placeholder="e.g. splunk-forwarder"
            />
            <Button
              color="orange"
              loading={createMutation.isPending}
              disabled={!newName.trim()}
              onClick={() => createMutation.mutate()}
            >
              Generate
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}

// Kept as a child so the table hook stays above the parent's early returns.
function ApiKeysTable({
  columns,
  keys,
}: {
  columns: ColumnDef<ApiKeyPublic>[]
  keys: ApiKeyPublic[]
}) {
  const table = useReactTable({
    data: keys,
    columns,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <DataTable
      table={table}
      minWidth={640}
      ariaLabel="API keys"
      emptyMessage="No API keys created yet."
    />
  )
}
