import { Button, Code, Modal, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  apiKeysQueryOptions,
  createApiKey,
  revokeApiKey,
  settingsKeys,
} from '#/components/Settings/settingsQueries'
import { compactDate, LoadingPanel, Panel, TableBox } from '#/components/Settings/settingsUi'

export function ApiKeysPanel() {
  const queryClient = useQueryClient()
  const { data: keys, isPending, isError, refetch, isFetching } = useQuery(apiKeysQueryOptions())
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKey, setNewKey] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createApiKey({ name: newName }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      setNewKey(created.key)
      setShowCreate(false)
      setNewName('')
      notifications.show({ color: 'green', message: 'API key generated - save it now' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to create API key',
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
        message: error instanceof Error ? error.message : 'Failed to revoke API key',
      }),
  })

  if (isPending) return <LoadingPanel label="Loading API keys..." />

  if (isError) {
    return (
      <Panel title="API keys">
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load API keys.</Text>
          <Button variant="default" loading={isFetching} onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Panel>
    )
  }

  const keyList = keys ?? []

  return (
    <>
      <Panel
        title="API keys"
        action={
          <Button variant="default" onClick={() => { setNewName(''); setNewKey(''); setShowCreate(true) }}>
            + Generate key
          </Button>
        }
      >
        {keyList.length ? (
          <TableBox>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Label</Table.Th>
                  <Table.Th>Key</Table.Th>
                  <Table.Th>Scope</Table.Th>
                  <Table.Th>Last used</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {keyList.map((key) => (
                  <Table.Tr key={key.id}>
                    <Table.Td>{key.name}</Table.Td>
                    <Table.Td>
                      <Code>{key.prefix}...{key.last_four}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" fz={11}>
                        {(key.scopes ?? []).join(', ') || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td ff="monospace" c="var(--faint)">
                      {compactDate(key.last_used_at)}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="default"
                        loading={revokeMutation.isPending && revokeMutation.variables === key.id}
                        onClick={() => revokeMutation.mutate(key.id)}
                      >
                        Revoke
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableBox>
        ) : (
          <Text c="dimmed" ta="center" py="xl">No API keys created yet.</Text>
        )}
      </Panel>

      <Modal
        opened={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate new API key"
      >
        {newKey ? (
          <Stack>
            <Text size="sm">Save this key — it won&#39;t be shown again:</Text>
            <Code block>{newKey}</Code>
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
