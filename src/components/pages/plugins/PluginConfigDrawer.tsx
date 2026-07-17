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
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Switch,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from '#/components/ui/AppDrawer'
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
  setAutoRunEnabled,
  setAutoApplyActions,
  pluginConfigQueryOptions,
  configStatusQueryOptions,
} from '#/components/Plugins/plugins'
import { usePermissions } from '#/lib/auth/usePermissions'
import { PluginVersionsTab } from './PluginVersionsTab'
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

/**
 * The proposed-action types an org may auto-apply without review. Mirrors the
 * backend `LOW_RISK_ACTIONS` set (`crud/plugin_proposed_action.py`) — the
 * `PUT /plugins/{id}/auto-apply` endpoint rejects anything outside it. Keep in
 * sync if the backend set changes.
 */
const AUTO_APPLY_ACTIONS: { value: string; label: string }[] = [
  { value: 'add_tag', label: 'Add tag' },
  { value: 'create_task', label: 'Create task' },
  { value: 'append_task_log', label: 'Append task log' },
  { value: 'add_related_observable', label: 'Add related observable' },
]

/**
 * One labelled row of manifest identifiers (capabilities / triggers /
 * permissions) rendered as badges. Renders nothing when the list is empty so
 * plugins that omit a section don't show a bare label.
 */
function MetaRow({
  label,
  items,
  color,
}: {
  label: string
  items?: string[]
  color: string
}) {
  if (!items || items.length === 0) return null
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Text
        fz={11}
        fw={600}
        c="dimmed"
        tt="uppercase"
        w={92}
        style={{ flexShrink: 0, lineHeight: 1.7 }}
      >
        {label}
      </Text>
      <Group gap={6} wrap="wrap">
        {items.map((v) => (
          <Badge
            key={v}
            variant="light"
            color={color}
            radius="sm"
            size="sm"
            tt="none"
            ff="monospace"
          >
            {v}
          </Badge>
        ))}
      </Group>
    </Group>
  )
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

  // ── Automation settings (auto-run, auto-apply) ─────────────────────────────
  // Managing automation is the same capability the backend gates these routes
  // on (`write:connector`). The controls only hide UI; the API is the boundary.
  const { can } = usePermissions()
  const canManageAutomation = can('write:connector')

  // The `plugin` prop is a snapshot from the catalog list, so it won't update in
  // place after a mutation. Mirror the two automation fields locally, seeded on
  // open and advanced by each mutation's returned plugin, for immediate feedback.
  const [autoRun, setAutoRun] = useState(plugin?.autoRunEnabled ?? false)
  const [autoApply, setAutoApply] = useState<string[]>(
    plugin?.autoApplyActions ?? [],
  )
  useEffect(() => {
    setAutoRun(plugin?.autoRunEnabled ?? false)
    setAutoApply(plugin?.autoApplyActions ?? [])
  }, [plugin?.id, plugin?.autoRunEnabled, plugin?.autoApplyActions])

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

  const invalidatePlugin = () => {
    queryClient.invalidateQueries({ queryKey: pluginKeys.catalog() })
    queryClient.invalidateQueries({ queryKey: pluginKeys.detail(plugin!.id) })
  }

  const autoRunMutation = useMutation({
    mutationFn: (enabled: boolean) => setAutoRunEnabled(plugin!.id, enabled),
    onSuccess: (updated) => {
      setAutoRun(updated.autoRunEnabled)
      invalidatePlugin()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Couldn't update auto-run: ${error instanceof Error ? error.message : 'Request failed'}`,
      }),
  })

  const autoApplyMutation = useMutation({
    mutationFn: (actions: string[]) => setAutoApplyActions(plugin!.id, actions),
    onSuccess: (updated) => {
      setAutoApply(updated.autoApplyActions)
      invalidatePlugin()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Couldn't update auto-apply: ${error instanceof Error ? error.message : 'Request failed'}`,
      }),
  })

  const toggleAutoApply = (action: string, checked: boolean) => {
    const next = checked
      ? [...autoApply, action]
      : autoApply.filter((a) => a !== action)
    autoApplyMutation.mutate(next)
  }

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
    return <AppDrawer opened={false} onClose={onClose} title="" size="lg" />
  }

  return (
    <AppDrawer
      opened
      onClose={onClose}
      title={plugin.displayName}
      size="lg"
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

        {/* Manifest metadata — what the plugin does, when it runs, what it can touch */}
        {(plugin.manifest.capabilities?.length ||
          plugin.manifest.triggers?.length ||
          plugin.manifest.permissions?.length) && (
          <Paper withBorder radius="md" p="sm">
            <Stack gap={8}>
              <MetaRow
                label="Capabilities"
                items={plugin.manifest.capabilities}
                color="violet"
              />
              <MetaRow
                label="Triggers"
                items={plugin.manifest.triggers}
                color="blue"
              />
              <MetaRow
                label="Permissions"
                items={plugin.manifest.permissions}
                color="gray"
              />
            </Stack>
          </Paper>
        )}

        {/* Automation — auto-run on triggers + auto-apply of low-risk actions */}
        <Paper withBorder radius="md" p="sm">
          <Stack gap="sm">
            <Text fz={11} fw={600} c="dimmed" tt="uppercase">
              Automation
            </Text>
            {!plugin.enabled ? (
              <Text fz={13} c="dimmed">
                Enable the plugin to configure automation.
              </Text>
            ) : null}
            <Tooltip
              label="You don't have permission to manage automation"
              disabled={canManageAutomation}
              withArrow
            >
              <Switch
                label="Auto-run on trigger events"
                description="Run automatically when a matching event fires (e.g. an observable is created), not just on manual runs."
                checked={autoRun}
                disabled={
                  readOnly ||
                  !plugin.enabled ||
                  !canManageAutomation ||
                  autoRunMutation.isPending
                }
                onChange={(e) => autoRunMutation.mutate(e.currentTarget.checked)}
              />
            </Tooltip>
            <Box>
              <Text fz={13} fw={500}>
                Auto-apply results
              </Text>
              <Text fz={12} c="dimmed" mb={6}>
                Apply these low-risk proposed actions without review. Others stay
                queued for approval.
              </Text>
              <Stack gap={6}>
                {AUTO_APPLY_ACTIONS.map((action) => (
                  <Checkbox
                    key={action.value}
                    label={action.label}
                    checked={autoApply.includes(action.value)}
                    disabled={
                      readOnly ||
                      !plugin.enabled ||
                      !canManageAutomation ||
                      autoApplyMutation.isPending
                    }
                    onChange={(e) =>
                      toggleAutoApply(action.value, e.currentTarget.checked)
                    }
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>

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
              <PluginVersionsTab pluginId={plugin.id} />
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
    </AppDrawer>
  )
}
