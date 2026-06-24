import { Button, Code, Table, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  auditsQueryOptions,
} from '#/components/Settings/settingsQueries'
import type { AuditPublic } from '#/components/Settings/settingsQueries'
import {
  compactDate,
  LoadingPanel,
  Panel,
  TableBox,
} from '#/components/Settings/settingsUi'

export function AuditLogPanel() {
  const { data, isPending } = useQuery(auditsQueryOptions())
  const items = data?.items ?? []

  if (isPending) return <LoadingPanel label="Loading audit log..." />

  return (
    <Panel
      title="Audit log"
      count={`${data?.total ?? items.length} events`}
      action={
        <Button
          variant="default"
          onClick={() => {
            // ponytail: client-side CSV export; proper server export if needed
            const header = 'Time,Actor,Action,Entity,Object,Org\n'
            const rows = items
              .map(
                (r) =>
                  `${r.created_at},${r.actor},${r.action},${r.object_type},${r.object_id},${r.context_id ?? ''}`,
              )
              .join('\n')
            const blob = new Blob([header + rows], {
              type: 'text/csv',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'audit-log.csv'
            a.click()
            URL.revokeObjectURL(url)
          }}
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
            {items.map((item: AuditPublic) => (
              <Table.Tr key={item.id}>
                <Table.Td ff="monospace" c="var(--faint)">
                  {compactDate(item.created_at)}
                </Table.Td>
                <Table.Td>{item.actor}</Table.Td>
                <Table.Td>
                  <Code>{item.action}</Code>
                </Table.Td>
                <Table.Td>{item.object_type}</Table.Td>
                <Table.Td ff="monospace" c="var(--faint)">
                  {item.object_id}
                </Table.Td>
                <Table.Td>
                  <Code>{item.context_id ?? '—'}</Code>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center">
                    No audit events found.
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
