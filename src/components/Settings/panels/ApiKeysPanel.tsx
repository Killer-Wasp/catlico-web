import { Button, Code, Table, Text } from '@mantine/core'
import { apiKeys } from '#/components/Settings/settingsData'
import {
  notify,
  Panel,
  RoleBadge,
  TableBox,
} from '#/components/Settings/settingsUi'

export function ApiKeysPanel() {
  return (
    <Panel
      title="API keys"
      action={
        <Button
          variant="default"
          onClick={() => notify('API key generated - shown once')}
        >
          + Generate key
        </Button>
      }
    >
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
            {apiKeys.map(([label, key, scope, lastUsed]) => (
              <Table.Tr key={label}>
                <Table.Td>{label}</Table.Td>
                <Table.Td>
                  <Code>{key}</Code>
                </Table.Td>
                <Table.Td>
                  <RoleBadge
                    role={
                      scope.includes('READ:METRICS') ? 'readonly' : 'analyst'
                    }
                  />
                  <Text component="span" ml={6} ff="monospace" fz={11}>
                    {scope}
                  </Text>
                </Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {lastUsed}
                </Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => notify(`${label} API key revoked`)}
                  >
                    Revoke
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
    </Panel>
  )
}
