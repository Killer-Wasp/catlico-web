import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Button, Group, Switch, Table, Text } from '@mantine/core'
import { ProfileBadge, TriggerBadge } from './Badges'
import type { FunctionAutomation } from './model'
import styles from './styles.module.css'
import { FuncPanel, PageHead } from './Panels'

export function FunctionsList({
  functions,
  onEdit,
  onNew,
  onToggle,
  loading,
}: {
  functions: FunctionAutomation[]
  onEdit: (fn: FunctionAutomation) => void
  onNew: () => void
  onToggle: (id: number, enabled: boolean) => void
  loading: boolean
}) {
  return (
    <Box className={classes.page}>
      <PageHead
        title="Functions"
        stamp="automation engine · scheduled, event, manual & API-triggered code · runs as a pinned profile"
        actions={
          <Button variant="default" onClick={onNew}>
            + New function
          </Button>
        }
      />

      <FuncPanel
        title="All functions"
        badge={`${functions.length} functions`}
        right={
          <Text ff="monospace" fz="xs" c="dimmed">
            click a function to edit
          </Text>
        }
      >
        <Box style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Text className={styles.columnHeader}>Function</Text>
                </Table.Th>
                <Table.Th>
                  <Text className={styles.columnHeader}>Trigger</Text>
                </Table.Th>
                <Table.Th>
                  <Text className={styles.columnHeader}>Runs as</Text>
                </Table.Th>
                <Table.Th>
                  <Text className={styles.columnHeader}>Runs / errors</Text>
                </Table.Th>
                <Table.Th>
                  <Text className={styles.columnHeader}>Last run</Text>
                </Table.Th>
                <Table.Th>
                  <Text className={styles.columnHeader}>Enabled</Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" c="dimmed" py={40}>
                    Loading functions...
                  </Table.Td>
                </Table.Tr>
              ) : functions.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} ta="center" c="dimmed" py={40}>
                    No functions yet. Create one to get started.
                  </Table.Td>
                </Table.Tr>
              ) : (
                functions.map((fn) => (
                  <Table.Tr key={fn.id}>
                    <Table.Td w="44%">
                      <Button
                        variant="transparent"
                        color="dark"
                        p={0}
                        h="auto"
                        justify="flex-start"
                        ta="left"
                        onClick={() => onEdit(fn)}
                        aria-label={`Edit ${fn.name}`}
                        styles={{
                          root: {
                            display: 'block',
                            width: '100%',
                            color: 'inherit',
                          },
                          label: { display: 'block', whiteSpace: 'normal' },
                        }}
                      >
                        <Text fw={700} c="dark.9">
                          {fn.name}
                        </Text>
                        <Text c="dimmed" size="sm">
                          {fn.description}
                        </Text>
                      </Button>
                    </Table.Td>
                    <Table.Td>
                      <TriggerBadge trigger={fn.trigger} />
                    </Table.Td>
                    <Table.Td>
                      <ProfileBadge profile={fn.profile} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={8}>
                        <Text fw={700}>{fn.runCount}</Text>
                        {fn.errorCount ? (
                          <>
                            <Text c="dimmed">·</Text>
                            <Text c="red.7" ff="monospace">
                              {fn.errorCount} err
                            </Text>
                          </>
                        ) : null}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" c="dimmed">
                        {fn.runs[0]?.started ?? '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        color="lime"
                        checked={fn.enabled}
                        onChange={(event) =>
                          onToggle(fn.id, event.currentTarget.checked)
                        }
                        aria-label={`${fn.enabled ? 'Disable' : 'Enable'} ${fn.name}`}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
        <Group justify="space-between" px="lg" py="md">
          <Text c="dimmed" ff="monospace">
            1-{Math.min(functions.length, 4)} of {functions.length}
          </Text>
        </Group>
      </FuncPanel>
    </Box>
  )
}
