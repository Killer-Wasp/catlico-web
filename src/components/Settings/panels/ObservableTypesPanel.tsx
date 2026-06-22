import { Badge, Button, Code, Table } from '@mantine/core'
import { observableTypes } from '#/components/Settings/settingsData'
import {
  notify,
  Panel,
  RoleBadge,
  TableBox,
} from '#/components/Settings/settingsUi'

export function ObservableTypesPanel() {
  return (
    <Panel
      title="Observable types"
      count={observableTypes.length}
      action={
        <Button
          variant="default"
          onClick={() => notify('Add observable type workflow opened')}
        >
          + Add type
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Validation regex</Table.Th>
              <Table.Th>Origin</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {observableTypes.map(([name, regex, origin]) => (
              <Table.Tr key={name}>
                <Table.Td>
                  <Badge variant="default">{name}</Badge>
                </Table.Td>
                <Table.Td>
                  <Code>{regex}</Code>
                </Table.Td>
                <Table.Td>
                  <RoleBadge
                    role={origin === 'BUILT-IN' ? 'readonly' : 'analyst'}
                  />
                </Table.Td>
                <Table.Td>
                  {origin === 'CUSTOM' && (
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => notify(`Observable type ${name} deleted`)}
                    >
                      Delete
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}
