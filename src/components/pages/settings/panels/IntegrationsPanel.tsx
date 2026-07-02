import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import type { Connector } from '#/components/Connectors/connectors.types'
import { ConnectorConfigDrawer } from '#/components/pages/settings/ConnectorConfigDrawer'
import {
  LoadingPanel,
  Panel,
  StatusBadge,
} from '#/components/pages/settings/settingsUi'

export function IntegrationsPanel() {
  const { data: connectors = [], isPending } = useQuery(
    connectorsQueryOptions(),
  )
  const [configConnector, setConfigConnector] = useState<Connector | null>(null)

  if (isPending) return <LoadingPanel label="Loading integrations..." />

  return (
    <>
      <ConnectorConfigDrawer
        connector={configConnector}
        saving={false}
        testing={false}
        onClose={() => setConfigConnector(null)}
        onSaved={() =>
          notifications.show({
            color: 'green',
            message: `${configConnector?.name ?? 'Integration'} configuration saved`,
          })
        }
      />
      <Panel title="Connected integrations">
        <Stack gap={0} p={18} pt={6} pb={6}>
          {connectors.map((connector) => (
            <Group
              key={connector.id}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="light" color={connector.color} miw={38}>
                {connector.initials}
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {connector.name}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {connector.description || connector.id}
                </Text>
              </Box>
              <StatusBadge
                state={
                  connector.available && connector.enabled
                    ? 'CONNECTED'
                    : connector.available
                      ? 'PAUSED'
                      : 'AUTH ERROR'
                }
              />
              <Button
                size="xs"
                variant="default"
                onClick={() => setConfigConnector(connector)}
              >
                {connector.available ? 'Configure' : 'Reconnect'}
              </Button>
            </Group>
          ))}
          {connectors.length === 0 && (
            <Text c="dimmed" fz={13} py={12}>
              No integrations returned by the backend.
            </Text>
          )}
        </Stack>
      </Panel>
    </>
  )
}
