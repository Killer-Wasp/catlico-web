import type {
  Connector,
  ConnectorConfigItem,
} from '#/components/Connectors/connectors.types'
import { isSecretConfigItem } from '#/components/Connectors/connectors'
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
import { KIND_COLOR } from './constants'

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
              <Badge
                variant="light"
                color={KIND_COLOR[connector.kind]}
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
