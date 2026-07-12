import {
  ActionIcon,
  Button,
  Checkbox,
  Code,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { usePermissions } from '#/lib/auth/usePermissions'
import { DataTable } from '#/components/Table/DataTable'
import type { ApiKeyPublic } from '#/components/pages/settings/settingsQueries'
import {
  apiKeysQueryOptions,
  createApiKey,
  permissionCatalogQueryOptions,
  revokeApiKey,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import {
  compactDate,
  confirmDelete,
  copyToClipboard,
  ErrorPanel,
  LoadingPanel,
  notify,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

const apiKeysKeyPrefix = [...settingsKeys.all, 'api-keys']

export function ApiKeysPanel() {
  const queryClient = useQueryClient()
  const {
    data: keys,
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(apiKeysQueryOptions())
  const { data: catalog = [] } = useQuery(permissionCatalogQueryOptions())
  const { groups: grantableGroups, isSuperadmin } = usePermissions()
  const grantable = new Set(grantableGroups)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [scopes, setScopes] = useState<Set<string>>(new Set())

  const createMutation = useMutation({
    mutationFn: () =>
      createApiKey({
        name: newName,
        scopes: [...scopes],
        // Native date input yields YYYY-MM-DD; treat it as end-of-day UTC so the
        // key stays valid through the chosen day. Omitted → non-expiring key.
        expires_at: newExpiresAt ? `${newExpiresAt}T23:59:59Z` : null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: apiKeysKeyPrefix })
      setNewKey(created.key)
      setNewName('')
      setNewExpiresAt('')
      setScopes(new Set())
      notifySuccess('API key generated - save it now')
    },
    onError: (error) => notifyError(error, 'Failed to create API key'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysKeyPrefix })
      notifySuccess('API key revoked')
    },
    onError: (error) => notifyError(error, 'Failed to revoke API key'),
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
        id: 'expires',
        header: 'Expires',
        cell: ({ row }) => (
          <Text ff="monospace" c="var(--faint)">
            {row.original.expires_at ? compactDate(row.original.expires_at) : 'never'}
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
              revokeMutation.isPending &&
              revokeMutation.variables === row.original.id
            }
            onClick={() =>
              confirmDelete({
                title: 'Revoke API key',
                message: `Revoke "${row.original.name}"? Any integration using it will stop working immediately.`,
                confirmLabel: 'Revoke',
                onConfirm: () => revokeMutation.mutate(row.original.id),
              })
            }
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
      <ErrorPanel
        label="Couldn't load API keys."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
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
              setNewExpiresAt('')
              setScopes(new Set())
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
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              styles={{ input: { fontFamily: 'monospace' } }}
              rightSection={
                <ActionIcon
                  variant="subtle"
                  aria-label="Copy API key"
                  onClick={() => {
                    void copyToClipboard(newKey).then((ok) =>
                      ok
                        ? notifySuccess('API key copied')
                        : notify('Press Ctrl/Cmd+C to copy the selected key'),
                    )
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
            <TextInput
              type="date"
              label="Expires"
              description="Leave blank for a non-expiring key"
              value={newExpiresAt}
              onChange={(e) => setNewExpiresAt(e.currentTarget.value)}
            />
            <Stack gap={6}>
              <Text size="sm" fw={600}>
                Scopes
              </Text>
              <Text size="xs" c="dimmed">
                A key can only be granted permissions you hold.
              </Text>
              {catalog.map((info) => {
                const allowed = isSuperadmin || grantable.has(info.key)
                return (
                  <Checkbox
                    key={info.key}
                    label={`${info.label}`}
                    description={info.key}
                    disabled={!allowed}
                    checked={scopes.has(info.key)}
                    onChange={(e) =>
                      setScopes((prev) => {
                        const next = new Set(prev)
                        if (e.currentTarget.checked) next.add(info.key)
                        else next.delete(info.key)
                        return next
                      })
                    }
                  />
                )
              })}
            </Stack>
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
