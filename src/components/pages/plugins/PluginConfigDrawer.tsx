/**
 * PluginConfigDrawer.tsx — the single shared drawer.
 *
 * Design:
 *  - @mantine/form + built-in schemaResolver (Mantine v9) consuming buildForm.ts
 *  - Save & test is one button flow: PUT dirty keys → POST config/test → render verdict inline
 *  - 422 parameter details map onto fields via form.setFieldError
 *  - Secret contract: absent key keeps, string replaces, null deletes
 *  - Environment-locked fields render readonly with lock icon
 *  - Config completeness gating for enable (tooltip until complete)
 *  - Dirty-keys-only submit via buildDirtyPayload
 */

import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm, schemaResolver } from '@mantine/form'
import { isHTTPError } from 'ky'
import { Check, Play, Save, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Plugin,
  PluginConfigParam,
  ParamConfigStatus,
  PluginRunnerStatus,
} from '#/components/Plugins/plugins.types'
import {
  pluginKeys,
  savePluginConfig,
  testPluginConfig,
  pluginConfigQueryOptions,
  configStatusQueryOptions,
} from '#/components/Plugins/plugins'
import { SchemaField } from './schema-form/Field'
import {
  buildFormSchema,
  buildDirtyPayload,
  isSecretParam,
} from './schema-form/buildForm'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// ── Props ───────────────────────────────────────────────────────────────────

export type PluginConfigDrawerProps = {
  plugin: Plugin | null
  configStatus?: Record<string, ParamConfigStatus>
  /** Runner statuses for the health gate (used by PluginsPage, not the drawer itself). */
  statuses?: PluginRunnerStatus[]
  /** Whether to show the admin-only versions tab. */
  isAdmin?: boolean
  /** Disable all config fields and hide Save/Test when runners are degraded. */
  readOnly?: boolean
  onClose: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isConfigComplete(
  params: PluginConfigParam[],
  configStatus?: Record<string, ParamConfigStatus>,
): boolean {
  if (!configStatus) return false
  return params
    .filter((p) => p.required)
    .every((p) => {
      const status = configStatus[p.name]
      return !status || status.status === 'configured'
    })
}

type FastAPIError = {
  detail: { loc: (string | number)[]; msg: string; type?: string }[]
}

// ── Component ───────────────────────────────────────────────────────────────

export function PluginConfigDrawer({
  plugin,
  configStatus: configStatusProp,
  isAdmin = false,
  readOnly = false,
  onClose,
}: PluginConfigDrawerProps) {
  const queryClient = useQueryClient()

  // Server-owned per-parameter status drives the completeness badge, secret
  // "Stored" flags, and enable gating. Prefer an explicitly-passed map (tests),
  // otherwise fetch it for the open plugin.
  const { data: fetchedStatus } = useQuery(
    configStatusQueryOptions(configStatusProp ? null : plugin?.id ?? null),
  )
  const configStatus = configStatusProp ?? fetchedStatus

  // Capture the baseline values at drawer open — they persist across saves so
  // buildDirtyPayload can always compare against the original snapshot.
  const baselineRef = useRef<Record<string, unknown>>({})

  // Load the org's currently-stored settings so the form shows real values
  // (precedence: org-config value → schema default → empty). Secrets are never
  // returned in the clear; the config_status query supplies their stored flags.
  const { data: config } = useQuery(pluginConfigQueryOptions(plugin?.id ?? null))
  const currentValues = config?.settings ?? {}

  // Build the form schema each time a new plugin opens or its config arrives.
  const { initialValues, zodSchema } = useMemo(() => {
    if (!plugin) return { initialValues: {} as Record<string, unknown>, zodSchema: undefined }
    const result = buildFormSchema(plugin.configParams, currentValues, configStatus)
    baselineRef.current = { ...result.initialValues }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin, configStatus, config])

  const form = useForm({
    initialValues,
    validate: zodSchema ? schemaResolver(zodSchema, { sync: true }) : undefined,
  })

  // Re-initialise when the drawer opens for a different plugin or its stored
  // settings load in. `config` flips from undefined→data asynchronously, so it
  // must be a dependency or the form would stay seeded with bare defaults.
  useEffect(() => {
    if (plugin) {
      form.setValues(initialValues)
      form.resetDirty()
      form.clearErrors()
      baselineRef.current = { ...initialValues }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin?.id, config])

  // Test outcome rendered inline above the footer.
  type TestOutcome = { ok: boolean; message: string; logTail?: string }
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null)

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof savePluginConfig>[1]) =>
      savePluginConfig(plugin!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pluginKeys.detail(plugin!.id) })
      queryClient.invalidateQueries({ queryKey: pluginKeys.configStatus(plugin!.id) })
      queryClient.invalidateQueries({ queryKey: pluginKeys.catalog() })
      notifications.show({ color: 'green', message: 'Configuration saved' })
      form.resetDirty()
    },
    onError: (saveError) => {
      if (isHTTPError(saveError) && saveError.response.status === 422) {
        saveError.response
          .json()
          .then((body) => {
            const detail = (body as FastAPIError).detail ?? []
            for (const d of detail) {
              const field = d.loc[d.loc.length - 1]
              if (typeof field === 'string') form.setFieldError(field, d.msg)
            }
          })
          .catch(() =>
            notifications.show({ color: 'red', message: 'Validation failed' }),
          )
        return
      }
      notifications.show({
        color: 'red',
        message: `Save failed: ${saveError instanceof Error ? saveError.message : 'Request failed'}`,
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: () => testPluginConfig(plugin!.id),
    onSuccess: (result) =>
      setTestOutcome({
        ok: result.ok,
        message: result.message,
        logTail: result.log_tail,
      }),
    onError: (error) =>
      setTestOutcome({
        ok: false,
        message: error instanceof Error ? error.message : 'Test failed',
      }),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!plugin) return
    const payload = buildDirtyPayload(
      plugin.configParams,
      baselineRef.current,
      form.getValues(),
    )
    if (Object.keys(payload).length === 0) {
      notifications.show({ color: 'blue', message: 'No changes to save' })
      return
    }
    setTestOutcome(null)
    saveMutation.mutate(payload)
  }

  const handleSaveAndTest = () => {
    if (!plugin) return
    const payload = buildDirtyPayload(
      plugin.configParams,
      baselineRef.current,
      form.getValues(),
    )
    setTestOutcome(null)
    if (Object.keys(payload).length === 0) {
      // Nothing dirty — test only
      testMutation.mutate()
      return
    }
    saveMutation.mutate(payload, {
      onSuccess: () => testMutation.mutate(),
    })
  }

  const handleClearSecret = (paramName: string) => {
    form.setFieldValue(paramName, null)
  }

  const complete = useMemo(
    () => isConfigComplete(plugin?.configParams ?? [], configStatus),
    [plugin, configStatus],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (!plugin) {
    return (
      <Drawer opened={false} onClose={onClose} position="right" size="lg" />
    )
  }

  return (
    <Drawer
      opened
      onClose={onClose}
      title={
        <Group gap="sm" wrap="nowrap">
          <Title order={3} size="h4">
            {plugin.displayName}
          </Title>
        </Group>
      }
      position="right"
      size="lg"
      padding="lg"
    >
      <Stack gap="md" h="100%">
        {/* Badges row */}
        <Group gap={8} wrap="wrap">
          <Badge variant="light" color={plugin.enabled ? 'green' : 'gray'} radius="sm">
            {plugin.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="light" color={plugin.available ? 'blue' : 'orange'} radius="sm">
            {plugin.available ? 'Available' : 'Not available'}
          </Badge>
          {plugin.manifest?.version && (
            <Badge variant="light" color="gray" radius="sm">
              {plugin.manifest.version}
            </Badge>
          )}
          {!complete && (
            <Tooltip label="Some required fields are missing or invalid" withArrow>
              <Badge variant="light" color="red" radius="sm">
                Incomplete config
              </Badge>
            </Tooltip>
          )}
          {complete && (
            <Badge variant="light" color="green" radius="sm">
              Config complete
            </Badge>
          )}
        </Group>

        {/* Description */}
        <Text fz={14} c="dimmed">
          {plugin.description || 'No description available.'}
        </Text>

        {/* Tab panels */}
        <Tabs defaultValue="config" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List>
            <Tabs.Tab value="config">Configuration</Tabs.Tab>
            {isAdmin && <Tabs.Tab value="versions">Versions</Tabs.Tab>}
          </Tabs.List>

          <Tabs.Panel value="config" pt="md" style={{ flex: 1, overflow: 'auto' }}>
            {plugin.configParams.length === 0 ? (
              <Text fz={14} c="dimmed">
                This plugin does not require configuration.
              </Text>
            ) : (
              <Box
                component="fieldset"
                disabled={readOnly}
                style={{ border: 0, padding: 0, margin: 0 }}
              >
                <Stack gap="sm">
                  {plugin.configParams.map((param) => (
                    <SchemaField
                      key={param.name}
                      param={param}
                      value={form.values[param.name]}
                      onChange={(value) =>
                        form.setFieldValue(param.name, value)
                      }
                      error={form.errors[param.name] as string | undefined}
                      storedSecret={
                        isSecretParam(param) &&
                        (configStatus?.[param.name]?.secret_configured ?? false)
                      }
                      onClearSecret={
                        isSecretParam(param)
                          ? () => handleClearSecret(param.name)
                          : undefined
                      }
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Tabs.Panel>

          {isAdmin && (
            <Tabs.Panel value="versions" pt="md" style={{ flex: 1, overflow: 'auto' }}>
              <Text fz={14} c="dimmed">
                Version management is not yet available.
              </Text>
            </Tabs.Panel>
          )}
        </Tabs>

        {/* Test outcome inline */}
        {testOutcome && (
          <Paper
            p="sm"
            radius="md"
            bg={testOutcome.ok ? 'green.0' : 'red.0'}
            style={{
              border: `1px solid var(--mantine-color-${testOutcome.ok ? 'green' : 'red'}-3)`,
            }}
          >
            <Group gap="xs" wrap="nowrap" align="flex-start">
              {testOutcome.ok ? (
                <Check size={16} color="var(--mantine-color-green-filled)" />
              ) : (
                <X size={16} color="var(--mantine-color-red-filled)" />
              )}
              <Stack gap={2}>
                <Text fz={13} fw={600}>
                  {testOutcome.ok ? 'Test passed' : 'Test failed'}
                </Text>
                <Text fz={12}>{testOutcome.message}</Text>
                {testOutcome.logTail && (
                  <Box
                    component="pre"
                    fz={11}
                    ff="monospace"
                    p={4}
                    mt={4}
                    style={{
                      background: 'var(--mantine-color-dark-8)',
                      color: 'var(--mantine-color-gray-2)',
                      borderRadius: 'var(--mantine-radius-sm)',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {testOutcome.logTail}
                  </Box>
                )}
              </Stack>
            </Group>
          </Paper>
        )}

        {/* Footer */}
        <Group justify="flex-end" mt="auto" pt="sm">
          {readOnly ? (
            <Text fz={13} c="dimmed">
              Configuration is read-only until all plugin runners are healthy.
            </Text>
          ) : (
            <>
              <Button
                variant="default"
                loading={saveMutation.isPending && !testMutation.isPending}
                onClick={handleSave}
                leftSection={<Save size={16} />}
              >
                Save
              </Button>
              <Button
                loading={saveMutation.isPending || testMutation.isPending}
                onClick={handleSaveAndTest}
                leftSection={
                  saveMutation.isPending || testMutation.isPending ? (
                    <Loader size={14} />
                  ) : (
                    <Play size={16} />
                  )
                }
              >
                Save &amp; Test
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Drawer>
  )
}
