import {
  Badge,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  createObservableType,
  deleteObservableType,
  observableTypesQueryOptions,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import type { ObservableTypePublic } from '#/components/pages/settings/settingsQueries'
import {
  LoadingPanel,
  Panel,
  TableBox,
} from '#/components/pages/settings/settingsUi'

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
        <TableBox>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Kind</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {types.map((type: ObservableTypePublic) => (
                <Table.Tr key={type.name}>
                  <Table.Td>
                    <Badge variant="default">{type.name}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Code>
                      {type.is_attachment ? 'attachment' : 'value'}
                    </Code>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="default"
                      loading={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(type.name)}
                    >
                      Delete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {types.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <Text c="dimmed" ta="center">
                      No observable types configured.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </TableBox>
      </Panel>
    </>
  )
}
