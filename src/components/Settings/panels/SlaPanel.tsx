import { Button, Group, Select, Table, Text, TextInput } from '@mantine/core'
import { slaPolicies } from '#/components/Settings/settingsData'
import { notify, Panel, TableBox } from '#/components/Settings/settingsUi'

export function SlaPanel() {
  return (
    <Panel title="SLA policies" count="per severity">
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Time to acknowledge</Table.Th>
              <Table.Th>Time to resolve</Table.Th>
              <Table.Th>Escalate to</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {slaPolicies.map(([severity, acknowledge, resolve, escalate]) => (
              <Table.Tr key={severity}>
                <Table.Td>
                  <Text
                    ff="monospace"
                    fw={700}
                    c={severity === 'CRITICAL' ? 'red.7' : 'orange.7'}
                  >
                    {severity}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${severity[0]}${severity.slice(1).toLowerCase()} time to acknowledge`}
                    defaultValue={acknowledge}
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${severity[0]}${severity.slice(1).toLowerCase()} time to resolve`}
                    defaultValue={resolve}
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    data={['On-call lead', 'CISO', 'Queue']}
                    defaultValue={escalate}
                    allowDeselect={false}
                    w={180}
                    aria-label={`${severity} escalation`}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
      <Group justify="flex-end" p={18} pt={0}>
        <Button color="orange" onClick={() => notify('SLA policies saved')}>
          Save SLA policies
        </Button>
      </Group>
    </Panel>
  )
}
