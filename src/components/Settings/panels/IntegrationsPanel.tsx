import { Badge, Box, Button, Group, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import {
  LoadingPanel,
  notify,
  Panel,
  StatusBadge,
} from '#/components/Settings/settingsUi'

export function IntegrationsPanel() {
  const { data: connectors = [], isPending } = useQuery(
    connectorsQueryOptions(),
  )

  if (isPending) return <LoadingPanel label="Loading integrations..." />

  return (
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
              onClick={() =>
                notify(
                  `${connector.available ? 'Configure' : 'Reconnect'} ${connector.name} workflow opened`,
                )
              }
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
  )
}
