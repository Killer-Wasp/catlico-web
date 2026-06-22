import classes from '#/components/Cases/CasesPage.module.css'
import {
  buildConnectorConfigPayload,
  connectorsQueryOptions,
  filterConnectorsByTab,
  getMissingRequiredConfigItems,
  initialConnectors,
  isSecretConfigItem,
  saveConnectorConfig,
  setConnectorEnabled,
  testConnectorConfig,
} from '#/components/Connectors/connectors'
import type {
  Connector,
  ConnectorConfigItem,
  ConnectorKind,
  ConnectorTab,
  TlpLevel,
} from '#/components/Connectors/connectors.types'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Group,
  NumberInput,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
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

function valueForItem(connector: Connector, item: ConnectorConfigItem) {
  if (isSecretConfigItem(item)) return ''
  return connector.settings[item.name] ?? item.defaultValue ?? ''
}

function ConfigField({
  item,
  value,
  storedSecret,
  onChange,
}: {
  item: ConnectorConfigItem
  value: unknown
  storedSecret: boolean
  onChange: (value: unknown) => void
}) {
  const description = item.description || undefined

  if (isSecretConfigItem(item)) {
    return (
      <PasswordInput
        label={item.name}
        aria-label={item.name}
        description={description}
        value={String(value ?? '')}
        placeholder={storedSecret ? 'Leave blank to keep stored secret' : ''}
        required={item.required}
        rightSection={
          storedSecret ? (
            <Badge size="xs" color="green" variant="light" radius="sm">
              Secret stored
            </Badge>
          ) : null
        }
        rightSectionWidth={storedSecret ? 112 : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  }

  if (item.type === 'integer' || item.type === 'number') {
    return (
      <NumberInput
        label={item.name}
        aria-label={item.name}
        description={description}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        required={item.required}
        onChange={onChange}
      />
    )
  }

  if (item.type === 'boolean') {
    return (
      <Checkbox
        label={item.name}
        aria-label={item.name}
        description={description}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    )
  }

  return (
    <TextInput
      label={item.name}
      aria-label={item.name}
      description={description}
      value={String(value ?? '')}
      required={item.required}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  )
}

function ConnectorConfigDrawer({
  connector,
  saving,
  testing,
  onClose,
  onSave,
  onTest,
}: {
  connector: Connector | null
  saving: boolean
  testing: boolean
  onClose: () => void
  onSave: (connector: Connector, values: Record<string, unknown>) => void
  onTest: (connector: Connector) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!connector) {
      setValues({})
      return
    }

    setValues(
      Object.fromEntries(
        connector.configItems.map((item) => [
          item.name,
          valueForItem(connector, item),
        ]),
      ),
    )
  }, [connector])

  return (
    <Drawer
      opened={connector !== null}
      onClose={onClose}
      title={connector ? `Configure ${connector.name}` : 'Configure connector'}
      position="right"
      size="md"
      padding="lg"
    >
      {connector ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSave(connector, values)
          }}
        >
          <Stack gap="md">
            <Group gap={8} wrap="wrap">
              <Badge variant="light" color={kindColor[connector.kind]} radius="sm">
                {connector.kind}
              </Badge>
              <Badge variant="light" color="gray" radius="sm">
                {connector.version}
              </Badge>
              {connector.hasSecrets ? (
                <Badge variant="light" color="green" radius="sm">
                  Secret stored
                </Badge>
              ) : null}
            </Group>

            <Text fz={14} c="dimmed">
              {connector.description || 'No description available.'}
            </Text>

            {connector.configItems.length ? (
              <Stack gap="sm">
                {connector.configItems.map((item) => (
                  <ConfigField
                    key={item.name}
                    item={item}
                    value={values[item.name]}
                    storedSecret={connector.hasSecrets && isSecretConfigItem(item)}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [item.name]: value,
                      }))
                    }
                  />
                ))}
              </Stack>
            ) : (
              <Text fz={14} c="dimmed">
                This connector does not require configuration.
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                type="button"
                loading={testing}
                onClick={() => onTest(connector)}
              >
                Test credentials
              </Button>
              <Button type="submit" loading={saving}>
                Save config
              </Button>
            </Group>
          </Stack>
        </form>
      ) : null}
    </Drawer>
  )
}

export function ConnectorsPage() {
  const queryClient = useQueryClient()
  const { data: connectors = initialConnectors, refetch } = useQuery(
    connectorsQueryOptions(),
  )
  const [activeTab, setActiveTab] = useState<ConnectorTab>('all')
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)
  const stamp = useStamp()

  const invalidateCatalog = () =>
    queryClient.invalidateQueries({ queryKey: connectorsQueryOptions().queryKey })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setConnectorEnabled(id, enabled),
    onSuccess: (connector) => {
      invalidateCatalog()
      notifications.show({
        color: connector.enabled ? 'green' : 'gray',
        message: `${connector.name} ${connector.enabled ? 'enabled' : 'disabled'}`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to update connector: ${errorMessage(error)}`,
      }),
  })

  const saveConfigMutation = useMutation({
    mutationFn: ({
      connector,
      values,
    }: {
      connector: Connector
      values: Record<string, unknown>
    }) =>
      saveConnectorConfig(
        connector.id,
        buildConnectorConfigPayload(connector.configItems, values),
      ),
    onSuccess: (connector) => {
      invalidateCatalog()
      setActiveConnector(connector)
      notifications.show({
        color: 'green',
        message: `${connector.name} configuration saved`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to save configuration: ${errorMessage(error)}`,
      }),
  })

  const testConfigMutation = useMutation({
    mutationFn: (connector: Connector) => testConnectorConfig(connector.id),
    onSuccess: (result) =>
      notifications.show({
        color: 'green',
        message: result.message,
      }),
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Credential test failed: ${errorMessage(error)}`,
      }),
  })

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

  const refreshCatalog = () =>
    refetch().then(() =>
      notifications.show({
        color: 'blue',
        message: 'Connector catalog refreshed',
      }),
    )

  const addInstance = () =>
    notifications.show({ color: 'orange', message: 'New connector instance' })

  const toggleConnector = (connector: Connector, enabled: boolean) => {
    if (enabled) {
      const missing = getMissingRequiredConfigItems(connector)
      if (missing.length) {
        notifications.show({
          color: 'red',
          message: `Configure ${connector.name} before enabling it. Missing: ${missing.join(
            ', ',
          )}`,
        })
        return
      }
    }

    toggleMutation.mutate({ id: connector.id, enabled })
  }

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
            onConfigure={setActiveConnector}
            onToggle={toggleConnector}
            toggling={
              toggleMutation.isPending &&
              toggleMutation.variables.id === connector.id
            }
          />
        ))}
      </SimpleGrid>

      <ConnectorConfigDrawer
        connector={activeConnector}
        saving={saveConfigMutation.isPending}
        testing={testConfigMutation.isPending}
        onClose={() => setActiveConnector(null)}
        onSave={(connector, values) =>
          saveConfigMutation.mutate({ connector, values })
        }
        onTest={(connector) => testConfigMutation.mutate(connector)}
      />
    </Box>
  )
}
