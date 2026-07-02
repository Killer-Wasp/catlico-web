import type { Connector } from '#/components/Connectors/connectors.types'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { KIND_COLOR, TLP_LEVEL_COLOR } from './constants'
import styles from './styles.module.css'

function ConnectorMark({ connector }: { connector: Connector }) {
  return (
    <Box
      w={50}
      h={50}
      ff="monospace"
      fz={13}
      fw={700}
      c={`${connector.color}.6`}
      style={{
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        borderRadius: 14,
        border: `1px solid var(--mantine-color-${connector.color}-3)`,
        background: `var(--mantine-color-${connector.color}-0)`,
      }}
    >
      {connector.initials}
    </Box>
  )
}

export function ConnectorCard({
  connector,
  onConfigure,
  onToggle,
  toggling,
}: {
  connector: Connector
  onConfigure: (connector: Connector) => void
  onToggle: (connector: Connector, enabled: boolean) => void
  toggling: boolean
}) {
  return (
    <Paper
      p="lg"
      radius="md"
      withBorder={false}
      shadow="xs"
      style={{ minHeight: 312 }}
    >
      <Stack h="100%" gap="md">
        <Group align="flex-start" wrap="nowrap">
          <ConnectorMark connector={connector} />
          <Box miw={0} flex={1}>
            <Text fw={700} fz={18} lh={1.2} truncate>
              {connector.name}
            </Text>
            <Group gap={6} mt={5} wrap="wrap">
              <Text ff="monospace" fz={11} c="dimmed">
                {connector.version}
              </Text>
              <Badge
                variant="light"
                color={KIND_COLOR[connector.kind]}
                size="sm"
                radius="sm"
                ff="monospace"
              >
                {connector.kind}
              </Badge>
            </Group>
          </Box>
          <Switch
            checked={connector.enabled}
            disabled={toggling}
            onChange={(event) =>
              onToggle(connector, event.currentTarget.checked)
            }
            color="green"
            size="md"
            aria-label={`${connector.name} enabled`}
          />
        </Group>

        <Text fz={15} c="var(--muted)" lh={1.45} style={{ minHeight: 66 }}>
          {connector.description}
        </Text>

        <Group gap={6} wrap="wrap">
          {connector.observables.map((observable) => (
            <Tag key={observable} label={observable} />
          ))}
          <Badge
            variant="light"
            color={TLP_LEVEL_COLOR[connector.tlp]}
            radius="sm"
            size="sm"
            ff="monospace"
          >
            &le; TLP:{connector.tlp}
          </Badge>
        </Group>

        <Divider color="var(--line-soft)" mt="auto" />

        <Group align="center" wrap="nowrap">
          <Box flex={1}>
            <Text className={styles.metricLabel}>runs 24h</Text>
            <Text ff="monospace" fz={13} c="var(--muted)">
              {connector.runs24h}
            </Text>
          </Box>
          <Box flex={1}>
            <Text className={styles.metricLabel}>avg latency</Text>
            <Text ff="monospace" fz={13} c="var(--muted)">
              {connector.latency}
            </Text>
          </Box>
          <Box flex={1}>
            <Text className={styles.metricLabel}>status</Text>
            <Text
              ff="monospace"
              fz={13}
              c={connector.enabled ? 'var(--ok)' : 'dimmed'}
            >
              {connector.enabled ? 'online' : 'disabled'}
            </Text>
          </Box>
          <Button
            variant="default"
            color="gray"
            onClick={() => onConfigure(connector)}
          >
            Configure
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
