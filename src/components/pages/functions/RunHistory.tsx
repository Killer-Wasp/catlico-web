import { Box, Group, Table, Text } from '@mantine/core'
import { StatusBadge, TriggerBadge } from './Badges'
import type { FunctionAutomation, FunctionTrigger } from './model'
import styles from './styles.module.css'
import { FuncPanel } from './Panels'

export function RunHistory({ runs }: { runs: FunctionAutomation['runs'] }) {
  return (
    <FuncPanel title="Run history" badge={`${runs.length} recent`}>
      <Box style={{ overflowX: 'auto' }}>
        <Table
          aria-label="Run history"
          horizontalSpacing="lg"
          verticalSpacing="sm"
        >
          <Table.Thead>
            <Table.Tr>
              {['Status', 'Trigger', 'Started', 'Duration', 'Attempts'].map(
                (label) => (
                  <Table.Th key={label}>
                    <Text className={styles.columnHeader}>{label}</Text>
                  </Table.Th>
                ),
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {runs.length ? (
              runs.map((run) => (
                <Table.Tr key={`${run.started}-${run.duration}`}>
                  <Table.Td>
                    <StatusBadge status={run.status} />
                  </Table.Td>
                  <Table.Td>
                    <TriggerBadge trigger={run.trigger as FunctionTrigger} />
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" c="dimmed">
                      {run.started}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text ff="monospace" c="dimmed">
                      {run.duration}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={8}>
                      <Text ff="monospace" c="dimmed">
                        {run.attempts}
                      </Text>
                      {run.error ? (
                        <>
                          <Text c="dimmed">·</Text>
                          <Text ff="monospace" c="red.7">
                            {run.error}
                          </Text>
                        </>
                      ) : null}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed">No runs yet.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Box>
    </FuncPanel>
  )
}
