import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  connectorsQueryOptions,
  testConnectorConfig,
} from '#/components/Connectors/connectors'
import type { Connector } from '#/components/Connectors/connectors.types'
import { ConnectorConfigDrawer } from '#/components/Connectors/ConnectorConfigDrawer'
import {
  LoadingPanel,
  Panel,
  StatusBadge,
} from '#/components/Settings/settingsUi'

export function ConnectorsPanel() {
  const { data: connectors = [], isPending } = useQuery(
    connectorsQueryOptions(),
  )
  const [configConnector, setConfigConnector] = useState<Connector | null>(null)
  const testMutation = useMutation({
    mutationFn: testConnectorConfig,
    onSuccess: (result) =>
      notifications.show({
        color: result.ok ? 'green' : 'red',
        message: result.message,
      }),
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to test connector',
      }),
  })
  const mispItems = connectors.filter((connector) =>
    `${connector.id} ${connector.name} ${connector.description}`
      .toLowerCase()
      .includes('misp'),
  )
  const cortexItems = connectors.filter((connector) =>
    `${connector.id} ${connector.name} ${connector.description}`
      .toLowerCase()
      .includes('cortex'),
  )
  const displayedMisp = mispItems.length ? mispItems : connectors

  if (isPending) return <LoadingPanel label="Loading connectors..." />

  return (
    <Stack gap="md">
      <ConnectorConfigDrawer
        connector={configConnector}
        saving={false}
        testing={testMutation.isPending}
        onClose={() => setConfigConnector(null)}
        onSaved={() =>
          notifications.show({
            color: 'green',
            message: `${configConnector?.name ?? 'Connector'} configuration saved`,
          })
        }
      />
      <Panel
        title="MISP connectors"
        count={displayedMisp.length}
        action={
          <Button
            variant="default"
            onClick={() =>
              notifications.show({
                color: 'orange',
                message: 'MISP connector instances can be added from the Connectors page.',
              })
            }
          >
            + Add MISP server
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {displayedMisp.map((connector) => (
            <Group
              key={connector.id}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="light" color="violet" miw={38}>
                {connector.initials}
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {connector.name}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {connector.id} - {connector.kind} - {connector.version} -{' '}
                  {connector.latency}
                </Text>
              </Box>
              <StatusBadge state={connector.enabled ? 'ENABLED' : 'PAUSED'} />
              <Button
                size="xs"
                variant="default"
                loading={
                  testMutation.isPending &&
                  testMutation.variables === connector.id
                }
                onClick={() => testMutation.mutate(connector.id)}
              >
                Test
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={() => setConfigConnector(connector)}
              >
                Configure
              </Button>
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Cortex servers"
        count={cortexItems.length}
        action={
          <Button
            variant="default"
            onClick={() =>
              notifications.show({
                color: 'orange',
                message: 'Cortex connector instances can be added from the Connectors page.',
              })
            }
          >
            + Add Cortex server
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {cortexItems.map((connector) => (
            <Group
              key={connector.id}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="light" color="violet" miw={38}>
                {connector.initials}
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {connector.name}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {connector.id} - {connector.observables.length} data types -{' '}
                  {connector.latency}
                </Text>
              </Box>
              <StatusBadge state={connector.available ? 'ONLINE' : 'PAUSED'} />
              <Button
                size="xs"
                variant="default"
                onClick={() =>
                  notifications.show({
                    color: 'blue',
                    message: 'Connector catalog refreshed.',
                  })
                }
              >
                Refresh catalog
              </Button>
              <Button
                size="xs"
                variant="default"
                onClick={() => setConfigConnector(connector)}
              >
                Configure
              </Button>
            </Group>
          ))}
          {cortexItems.length === 0 && (
            <Text c="dimmed" fz={13} py={12}>
              No Cortex connectors returned by the backend.
            </Text>
          )}
        </Stack>
      </Panel>
    </Stack>
  )
}
