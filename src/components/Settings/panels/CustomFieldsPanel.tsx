import { Badge, Button, Code, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  customFieldsQueryOptions,
  deleteCustomField,
  settingsKeys,
} from '#/components/Settings/settingsQueries'
import type { CustomFieldPublic } from '#/components/Settings/settingsQueries'
import {
  LoadingPanel,
  notify,
  Panel,
  TableBox,
} from '#/components/Settings/settingsUi'

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
  const fields = data?.fields ?? []

  if (isPending) return <LoadingPanel label="Loading custom fields..." />

  return (
    <Panel
      title="Custom field definitions"
      count={fields.length}
      action={
        <Button
          variant="default"
          onClick={() => notify('Add custom field workflow opened')}
        >
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
                <Table.Td fw={700}>{field.display_name || field.name}</Table.Td>
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
  )
}
