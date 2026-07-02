import {
  Badge,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
  LoadingPanel,
  Panel,
  TableBox,
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
        <TableBox>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Label</Table.Th>
                <Table.Th>Key</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Mandatory</Table.Th>
                <Table.Th>Multi-value</Table.Th>
                <Table.Th>Used by</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field: CustomFieldPublic) => (
                <Table.Tr key={field.id}>
                  <Table.Td fw={700}>
                    {field.display_name || field.name}
                  </Table.Td>
                  <Table.Td>
                    <Code>{field.name}</Code>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="default">{field.field_type}</Badge>
                  </Table.Td>
                  <Table.Td c={field.mandatory ? 'yellow.7' : 'dimmed'}>
                    {field.mandatory ? 'required' : 'optional'}
                  </Table.Td>
                  <Table.Td>{field.options.length ? 'yes' : 'no'}</Table.Td>
                  <Table.Td ff="monospace" c="var(--faint)">
                    {field.organisation_id}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="default"
                      loading={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(field.id)}
                    >
                      Delete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {fields.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center">
                      No custom fields configured.
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
