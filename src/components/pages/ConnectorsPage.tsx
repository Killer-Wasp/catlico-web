import classes from '#/components/Cases/CasesPage.module.css'
import {
  buildConnectorConfigPayload,
  connectorsQueryOptions,
  filterConnectorsByTab,
  getMissingRequiredConfigItems,
  initialConnectors,
  saveConnectorConfig,
  setConnectorEnabled,
  testConnectorConfig,
} from '#/components/Connectors/connectors'
import type {
  Connector,
  ConnectorTab,
} from '#/components/Connectors/connectors.types'
import {
  Box,
  Button,
  Group,
  SimpleGrid,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConnectorCard } from './connectors/ConnectorCard'
import { ConnectorConfigDrawer } from './connectors/ConnectorConfigDrawer'
import {
  errorMessage,
  isConnectorTab,
  TAB_OPTIONS,
  useStamp,
} from './connectors/constants'

export function ConnectorsPage() {
  const queryClient = useQueryClient()
  const { data: connectors = initialConnectors, refetch } = useQuery(
    connectorsQueryOptions(),
  )
  const [activeTab, setActiveTab] = useState<ConnectorTab>('all')
  const [activeConnector, setActiveConnector] = useState<Connector | null>(null)
  const stamp = useStamp()

  const invalidateCatalog = () =>
    queryClient.invalidateQueries({
      queryKey: connectorsQueryOptions().queryKey,
    })

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
          {TAB_OPTIONS.map((tab) => (
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
