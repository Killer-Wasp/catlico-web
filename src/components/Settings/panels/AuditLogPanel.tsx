import { Button, Code, Table } from '@mantine/core'
import { auditEvents } from '#/components/Settings/settingsData'
import { notify, Panel, TableBox } from '#/components/Settings/settingsUi'

export function AuditLogPanel() {
  return (
    <Panel
      title="Audit log"
      count={`${auditEvents.length} events`}
      action={
        <Button
          variant="default"
          onClick={() => notify('Audit log exported - audit-log.csv')}
        >
          Export CSV
        </Button>
      }
    >
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Entity</Table.Th>
              <Table.Th>Object</Table.Th>
              <Table.Th>Org</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {auditEvents.map(([time, actor, action, entity, object, org]) => (
              <Table.Tr key={`${time}-${action}-${object}`}>
                <Table.Td ff="monospace" c="var(--faint)">
                  {time}
                </Table.Td>
                <Table.Td>{actor}</Table.Td>
                <Table.Td>
                  <Code>{action}</Code>
                </Table.Td>
                <Table.Td>{entity}</Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {object}
                </Table.Td>
                <Table.Td>
                  <Code>{org}</Code>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}
