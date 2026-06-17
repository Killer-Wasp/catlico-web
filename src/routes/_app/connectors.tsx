import classes from '#/components/Cases/CasesPage.module.css'
import type {
  Connector,
  ConnectorKind,
  ConnectorTab,
  TlpLevel,
} from '#/components/Connectors/connectorsData'
import {
  filterConnectorsByTab,
  initialConnectors,
} from '#/components/Connectors/connectorsData'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export const Route = createFileRoute('/_app/connectors')({
  component: ConnectorsPage,
})

const tabOptions: { value: ConnectorTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'analyzers', label: 'Analyzers' },
  { value: 'responders', label: 'Responders' },
  { value: 'disabled', label: 'Disabled' },
]

const kindColor: Record<ConnectorKind, string> = {
  analyzer: 'violet',
  responder: 'orange',
}

const tlpColor: Record<TlpLevel, string> = {
  GREEN: 'green',
  AMBER: 'yellow',
  RED: 'red',
}

const metricLabelProps = {
  ff: 'monospace',
  fz: 11,
  c: 'dimmed',
  style: { lineHeight: 1.25 },
} as const

function isConnectorTab(value: string | null): value is ConnectorTab {
  return tabOptions.some((tab) => tab.value === value)
}

function useStamp() {
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Australia/Brisbane',
    })
    const time = now
      .toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Brisbane',
      })
      .toLowerCase()
    setStamp(`${date}, ${time} AEST`)
  }, [])
  return stamp
}

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

function ConnectorCard({
  connector,
  onConfigure,
  onToggle,
}: {
  connector: Connector
  onConfigure: (connector: Connector) => void
  onToggle: (id: string, enabled: boolean) => void
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
                color={kindColor[connector.kind]}
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
            onChange={(event) =>
              onToggle(connector.id, event.currentTarget.checked)
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
            color={tlpColor[connector.tlp]}
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
            <Text {...metricLabelProps}>runs 24h</Text>
            <Text ff="monospace" fz={13} c="var(--muted)">
              {connector.runs24h}
            </Text>
          </Box>
          <Box flex={1}>
            <Text {...metricLabelProps}>avg latency</Text>
            <Text ff="monospace" fz={13} c="var(--muted)">
              {connector.latency}
            </Text>
          </Box>
          <Box flex={1}>
            <Text {...metricLabelProps}>status</Text>
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

function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>(initialConnectors)
  const [activeTab, setActiveTab] = useState<ConnectorTab>('all')
  const stamp = useStamp()

  const visible = useMemo(
    () => filterConnectorsByTab(connectors, activeTab),
    [connectors, activeTab],
  )

  const counts = useMemo(
    () => ({
      all: connectors.length,
      analyzers: filterConnectorsByTab(connectors, 'analyzers').length,
      responders: filterConnectorsByTab(connectors, 'responders').length,
      disabled: filterConnectorsByTab(connectors, 'disabled').length,
    }),
    [connectors],
  )

  const toggleConnector = (id: string, enabled: boolean) => {
    setConnectors((current) =>
      current.map((connector) =>
        connector.id === id ? { ...connector, enabled } : connector,
      ),
    )
    const connector = connectors.find((item) => item.id === id)
    notifications.show({
      color: enabled ? 'green' : 'gray',
      message: `${connector?.name ?? 'Connector'} ${
        enabled ? 'enabled' : 'disabled'
      }`,
    })
  }

  const configureConnector = (connector: Connector) =>
    notifications.show({ message: `Configuring ${connector.name}...` })

  const refreshCatalog = () =>
    notifications.show({
      color: 'blue',
      message: 'Connector catalog refreshed',
    })

  const addInstance = () =>
    notifications.show({ color: 'orange', message: 'New connector instance' })

  return (
    <Box className={classes.page}>
      <Group align="center" gap={14} mb={24} wrap="wrap">
        <Group align="baseline" gap={14} wrap="wrap">
          <Title order={1} size="h2">
            Connectors
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {stamp}
          </Text>
        </Group>
        <Group gap={10} ml="auto" wrap="wrap">
          <Button
            variant="default"
            leftSection={<RefreshCw size={16} />}
            onClick={refreshCatalog}
          >
            Refresh catalog
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={addInstance}>
            Add instance
          </Button>
        </Group>
      </Group>

      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (isConnectorTab(value)) setActiveTab(value)
        }}
        variant="pills"
        color="dark"
        radius="md"
        mb="lg"
      >
        <Tabs.List>
          {tabOptions.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              <Group gap={7} wrap="nowrap">
                <Text component="span" fw={600}>
                  {tab.label}
                </Text>
                <Text component="span" ff="monospace" fz={11} c="dimmed">
                  {counts[tab.value]}
                </Text>
              </Group>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <SimpleGrid
        cols={{ base: 1, md: 2, xl: 3 }}
        spacing="lg"
        verticalSpacing="lg"
      >
        {visible.map((connector) => (
          <ConnectorCard
            key={connector.id}
            connector={connector}
            onConfigure={configureConnector}
            onToggle={toggleConnector}
          />
        ))}
      </SimpleGrid>
    </Box>
  )
}
