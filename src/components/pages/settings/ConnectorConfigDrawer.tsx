import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  NumberInput,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  buildConnectorConfigPayload,
  isSecretConfigItem,
  saveConnectorConfig,
  testConnectorConfig,
} from '#/components/Connectors/connectors'
import type { Connector, ConnectorConfigItem } from '#/components/Connectors/connectors.types'

const kindColor = {
  analyzer: 'violet',
  responder: 'orange',
} as const

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
        value={
          typeof value === 'number' || typeof value === 'string' ? value : ''
        }
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

export function ConnectorConfigDrawer({
  connector,
  saving,
  testing,
  onClose,
  onSaved,
}: {
  connector: Connector | null
  saving: boolean
  testing: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [savingLocal, setSavingLocal] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

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
    setTestResult(null)
  }, [connector])

  async function handleTest() {
    if (!connector) return
    try {
      const result = await testConnectorConfig(connector.id)
      setTestResult(result.message)
    } catch (error) {
      setTestResult(
        error instanceof Error ? error.message : 'Test failed',
      )
    }
  }

  async function handleSave() {
    if (!connector) return
    setSavingLocal(true)
    try {
      await saveConnectorConfig(
        connector.id,
        buildConnectorConfigPayload(connector.configItems, values),
      )
      onSaved()
      onClose()
    } catch {
      // error shown via parent mutation handler
    } finally {
      setSavingLocal(false)
    }
  }

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
            void handleSave()
          }}
        >
          <Stack gap="md">
            <Group gap={8} wrap="wrap">
              <Badge
                variant="light"
                color={kindColor[connector.kind]}
                radius="sm"
              >
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
                    storedSecret={
                      connector.hasSecrets && isSecretConfigItem(item)
                    }
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

            {testResult && (
              <Text fz={13} c="dimmed">
                Test result: {testResult}
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                type="button"
                loading={testing}
                onClick={() => void handleTest()}
              >
                Test credentials
              </Button>
              <Button type="submit" loading={saving || savingLocal}>
                Save config
              </Button>
            </Group>
          </Stack>
        </form>
      ) : null}
    </Drawer>
  )
}
