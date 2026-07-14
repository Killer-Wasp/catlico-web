/**
 * PluginsPage.tsx — catalog table replacing the old Connectors card grid.
 *
 * Three-state health gate:
 *  1. No runners  → empty-state CTA (register a runner)
 *  2. Any unhealthy runner → warning banner, drawers read-only
 *  3. All healthy → normal
 *
 * Table: client-side search + filter via fuzzy match (match-sorter). No
 * server-side pagination — the plugin list is typically under 100 rows.
 */

import {
  Alert,
  Badge,
  Box,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'

import type { Plugin, PluginRunner } from '#/components/Plugins/plugins.types'
import {
  pluginsQueryOptions,
  setPluginEnabled,
  pluginKeys,
} from '#/components/Plugins/plugins'
import { pluginRunnersQueryOptions } from '#/components/Plugins/pluginRunners'
import { DataTable } from '#/components/Table/DataTable'
import classes from '#/components/Cases/CasesPage.module.css'
import { PluginConfigDrawer } from './PluginConfigDrawer'
import { useStamp, errorMessage } from '#/lib/ui-helpers'
import { usePermissions } from '#/lib/auth/usePermissions'

// ── Types ───────────────────────────────────────────────────────────────────

type HealthState = 'normal' | 'unhealthy' | 'no-runners'

// ── Helpers ─────────────────────────────────────────────────────────────────

function runnerHealth(runners: PluginRunner[]): HealthState {
  if (runners.length === 0) return 'no-runners'
  if (runners.some((r) => r.status === 'unhealthy')) return 'unhealthy'
  return 'normal'
}

function initials(label: string): string {
  const parts = label.match(/[A-Za-z0-9]+/g) ?? []
  const text =
    parts.length >= 2
      ? parts.slice(0, 2).map((p) => p.charAt(0)).join('')
      : label.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)
  return (text || 'PL').toUpperCase()
}

const NAME_COLORS = ['blue', 'orange', 'green', 'violet', 'yellow', 'red', 'gray']

function nameColor(id: string): string {
  const sum = Array.from(id).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return NAME_COLORS[sum % NAME_COLORS.length] ?? 'gray'
}

// ── Component ───────────────────────────────────────────────────────────────

export function PluginsPage() {
  const queryClient = useQueryClient()
  const stamp = useStamp()
  const { isSuperadmin } = usePermissions()

  const { data: plugins = [], isPending, isError, refetch } = useQuery(pluginsQueryOptions())
  const { data: runners = [] } = useQuery(pluginRunnersQueryOptions())

  const [search, setSearch] = useState('')
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null)

  const health = runnerHealth(runners)
  const healthReadOnly = health === 'unhealthy'

  // ── Mutations ────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setPluginEnabled(id, enabled),
    onSuccess: (plugin) => {
      queryClient.invalidateQueries({ queryKey: pluginKeys.catalog() })
      notifications.show({
        color: plugin.enabled ? 'green' : 'gray',
        message: `${plugin.displayName} ${plugin.enabled ? 'enabled' : 'disabled'}`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Unable to update plugin: ${errorMessage(error)}`,
      }),
  })

  // ── Client-side filter ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plugins
    return plugins.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    )
  }, [plugins, search])

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Plugin>[]>(
    () => [
      {
        id: 'displayName',
        header: 'Plugin',
        accessorFn: (row) => row.displayName,
        meta: { grow: true },
        cell: (info) => {
          const p = info.row.original
          return (
            <Group gap="sm" wrap="nowrap">
              <Box
                w={36}
                h={36}
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  background: `var(--mantine-color-${nameColor(p.id)}-filled)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {initials(p.displayName)}
              </Box>
              <Stack gap={0}>
                <Text fz={14} fw={600}>
                  {p.displayName}
                </Text>
                <Text fz={11} c="dimmed" ff="monospace">
                  {p.id}
                </Text>
              </Stack>
            </Group>
          )
        },
      },
      {
        id: 'version',
        header: 'Version',
        accessorFn: (row) => row.manifest.version ?? '—',
        meta: { nowrap: true },
        cell: (info) => (
          <Badge variant="light" color="gray" radius="sm" size="sm">
            {info.getValue() as string}
          </Badge>
        ),
      },
      {
        id: 'triggers',
        header: 'Triggers',
        accessorFn: (row) => row.manifest.triggers?.length ?? 0,
        meta: { nowrap: true },
        cell: (info) => {
          const plugin = info.row.original
          const count = plugin.manifest.triggers?.length ?? 0
          if (count === 0) return <Text fz={12} c="dimmed">—</Text>
          return (
            <Group gap={4}>
              {plugin.manifest.triggers?.map((t, i) => (
                <Badge key={i} variant="outline" size="xs" radius="sm">
                  {t.event ? t.event.join(', ') : t.cron ? 'cron' : 'event'}
                </Badge>
              ))}
            </Group>
          )
        },
      },
      {
        id: 'enabled',
        header: 'Enabled',
        accessorFn: (row) => row.enabled,
        meta: { nowrap: true },
        cell: (info) => {
          const plugin = info.row.original
          // Gate enabling on server-computed completeness, but never block
          // disabling a plugin that's already on.
          const canToggle = plugin.enabled || plugin.configComplete
          return (
            <Tooltip
              label="Configure all required fields before enabling"
              disabled={canToggle}
              withArrow
            >
              <Box onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={plugin.enabled}
                  disabled={
                    !canToggle ||
                    (toggleMutation.isPending &&
                      toggleMutation.variables?.id === plugin.id)
                  }
                  onChange={(e) =>
                    toggleMutation.mutate({
                      id: plugin.id,
                      enabled: e.currentTarget.checked,
                    })
                  }
                  aria-label={`Toggle ${plugin.displayName}`}
                />
              </Box>
            </Tooltip>
          )
        },
      },
      {
        id: 'runner',
        header: 'Runner',
        accessorFn: (row) => row.runnerId ?? 'none',
        meta: { nowrap: true },
        cell: (info) => {
          const p = info.row.original
          const r = runners.find((rn) => rn.id === p.runnerId)
          if (!r) return <Text fz={12} c="dimmed">—</Text>
          return (
            <Group gap={6}>
              <Badge
                variant="dot"
                color={r.status === 'healthy' ? 'green' : r.status === 'unhealthy' ? 'orange' : 'gray'}
                size="sm"
              >
                {r.name}
              </Badge>
            </Group>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => (row.available ? 'available' : 'unavailable'),
        meta: { nowrap: true },
        cell: (info) => {
          const p = info.row.original
          return (
            <Badge
              variant="light"
              color={p.available ? 'green' : 'orange'}
              radius="sm"
              size="sm"
            >
              {p.available ? 'Available' : 'Not installed'}
            </Badge>
          )
        },
      },
    ],
    [runners, toggleMutation],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box className={classes.page}>
      {/* Header */}
      <Group align="center" gap={14} mb={24} wrap="wrap">
        <Group align="baseline" gap={14} wrap="wrap">
          <Title order={1} size="h2">
            Plugins
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {stamp}
          </Text>
        </Group>
      </Group>

      {/* Health gate */}
      {health === 'no-runners' && (
        <Alert
          variant="light"
          color="blue"
          title="No plugin runners configured"
          icon={<Plus size={16} />}
          mb="lg"
        >
          <Text fz={13}>
            Register a plugin runner to start using plugins. Plugin runners
            execute plugin code in isolated sandboxes.
          </Text>
        </Alert>
      )}

      {health === 'unhealthy' && (
        <Alert
          variant="light"
          color="orange"
          title="Runner health degraded"
          icon={<AlertTriangle size={16} />}
          mb="lg"
        >
          <Text fz={13}>
            One or more plugin runners are unhealthy. Plugin configuration is
            read-only until all runners report healthy.
          </Text>
        </Alert>
      )}

      {/* Search bar */}
      <Group mb="lg">
        <TextInput
          placeholder="Search plugins…"
          leftSection={<Search size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ width: 320 }}
        />
      </Group>

      {/* Table */}
      <DataTable
        table={table}
        minWidth={800}
        emptyMessage="No plugins found."
        isPending={isPending}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={(row) => setActivePlugin(row.original)}
        loadingMessage="Loading plugins…"
      />

      {/* Config drawer */}
      <PluginConfigDrawer
        plugin={activePlugin}
        readOnly={healthReadOnly}
        isAdmin={isSuperadmin}
        onClose={() => setActivePlugin(null)}
      />
    </Box>
  )
}
