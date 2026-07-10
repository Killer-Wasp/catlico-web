/**
 * RunnersPage — super-admin page for managing plugin runners.
 *
 * Table: name, status chip (healthy/unhealthy/offline), enrollment state,
 * version, isolation mode, plugin count, last heartbeat.
 *
 * Add-runner flow shows the one-time enrollment token once with copy + TTL
 * countdown via an EnrollTokenModal.
 */

import {
  Badge,
  Box,
  Button,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from '@mantine/form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Check, Copy, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'

import type { PluginRunner, CreateRunnerResponse } from '#/components/Plugins/plugins.types'
import {
  pluginRunnersQueryOptions,
  createPluginRunner,
  triggerHealthCheck,
  triggerSync,
  runnerKeys,
} from '#/components/Plugins/pluginRunners'
import { DataTable } from '#/components/Table/DataTable'
import classes from '#/components/Cases/CasesPage.module.css'
import { useStamp, errorMessage } from '#/lib/ui-helpers'

// ── Health dot ──────────────────────────────────────────────────────────────

function HealthDot({ status }: { status: string }) {
  const color =
    status === 'healthy' ? 'green' : status === 'unhealthy' ? 'orange' : 'gray'
  return <Badge variant="dot" color={color}>{status}</Badge>
}

// ── TTL countdown hook ──────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = dayjs(expiresAt).diff(dayjs(), 'second')
      if (diff <= 0) { setRemaining(0); return }
      setRemaining(diff)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])
  return remaining
}

// ── Enroll token modal ─────────────────────────────────────────────────────

function EnrollTokenModal({
  token,
  open,
  onClose,
}: {
  token: CreateRunnerResponse | null
  open: boolean
  onClose: () => void
}) {
  const remaining = useCountdown(token?.enrollment_token_expires_at ?? null)

  if (!token) return null

  return (
    <Modal opened={open} onClose={onClose} title="Enrollment token" size="lg">
      <Stack gap="md">
        <Text fz={14}>
          Save this token — it will not be shown again. The runner uses this
          token to enroll with the Catlico API.
        </Text>

        <Box
          p="md"
          style={{
            background: 'var(--mantine-color-dark-8)',
            borderRadius: 'var(--mantine-radius-md)',
            fontFamily: 'monospace',
            fontSize: 14,
            wordBreak: 'break-all',
            color: 'var(--mantine-color-gray-2)',
          }}
        >
          {token.enrollment_token}
        </Box>

        <Group justify="space-between">
          <CopyButton value={token.enrollment_token}>
            {({ copied, copy }) => (
              <Button
                variant={copied ? 'light' : 'default'}
                color={copied ? 'green' : undefined}
                leftSection={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={copy}
                size="sm"
              >
                {copied ? 'Copied' : 'Copy token'}
              </Button>
            )}
          </CopyButton>
          {remaining !== null && remaining > 0 && (
            <Text fz={12} c="dimmed" ff="monospace">
              Expires in {remaining}s
            </Text>
          )}
          {remaining === 0 && (
            <Text fz={12} c="red" ff="monospace">
              Token expired
            </Text>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}

// ── RunnersPage component ───────────────────────────────────────────────────

export function RunnersPage() {
  const queryClient = useQueryClient()
  const stamp = useStamp()

  const { data: runners = [], isPending, isError, refetch } = useQuery(pluginRunnersQueryOptions())

  const [addOpen, setAddOpen] = useState(false)
  const [enrollToken, setEnrollToken] = useState<CreateRunnerResponse | null>(null)

  const addForm = useForm({
    initialValues: { id: '', name: '', base_url: '' },
  })

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (values: typeof addForm.values) =>
      createPluginRunner(values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: runnerKeys.list() })
      setAddOpen(false)
      setEnrollToken(result)
      addForm.reset()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Failed to create runner: ${errorMessage(error)}`,
      }),
  })

  const healthCheckMutation = useMutation({
    mutationFn: (id: string) => triggerHealthCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runnerKeys.list() })
      notifications.show({ color: 'green', message: 'Health check triggered' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Health check failed: ${errorMessage(error)}`,
      }),
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => triggerSync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: runnerKeys.list() })
      notifications.show({ color: 'green', message: 'Sync triggered' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Sync failed: ${errorMessage(error)}`,
      }),
  })

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<PluginRunner>[]>(
    () => [
      {
        id: 'name',
        header: 'Runner',
        accessorFn: (row) => row.name,
        meta: { grow: true },
        cell: (info) => {
          const r = info.row.original
          return (
            <Stack gap={0}>
              <Text fz={14} fw={600}>{r.name}</Text>
              <Text fz={11} c="dimmed" ff="monospace">{r.id}</Text>
            </Stack>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        meta: { nowrap: true },
        cell: (info) => <HealthDot status={info.getValue() as string} />,
      },
      {
        id: 'version',
        header: 'Version',
        accessorFn: (row) => row.version || '—',
        meta: { nowrap: true },
        cell: (info) => (
          <Text fz={13} ff="monospace" c="dimmed">
            {info.getValue() as string}
          </Text>
        ),
      },
      {
        id: 'isolation',
        header: 'Isolation',
        accessorFn: (row) => row.isolationMode,
        meta: { nowrap: true },
        cell: (info) => (
          <Badge variant="outline" size="sm" radius="sm">
            {info.getValue() as string}
          </Badge>
        ),
      },
      {
        id: 'lastHeartbeat',
        header: 'Last heartbeat',
        accessorFn: (row) => row.lastHeartbeatAt,
        meta: { nowrap: true },
        cell: (info) => {
          const v = info.getValue() as string | null
          if (!v) return <Text fz={12} c="dimmed">—</Text>
          return (
            <Text fz={12} ff="monospace" c="dimmed">
              {dayjs(v).fromNow()}
            </Text>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        meta: { nowrap: true },
        cell: (info) => (
          <Group gap={6} justify="flex-end">
            <Button
              variant="default"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                healthCheckMutation.mutate(info.row.original.id)
              }}
              loading={healthCheckMutation.isPending}
            >
              Health
            </Button>
            <Button
              variant="default"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                syncMutation.mutate(info.row.original.id)
              }}
              loading={syncMutation.isPending}
            >
              Sync
            </Button>
          </Group>
        ),
      },
    ],
    [healthCheckMutation, syncMutation],
  )

  const table = useReactTable({
    data: runners,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box className={classes.page}>
      <Group align="center" gap={14} mb={24} wrap="wrap">
        <Group align="baseline" gap={14} wrap="wrap">
          <Title order={1} size="h2">
            Plugin Runners
          </Title>
          <Text component="span" ff="monospace" fz={11} c="dimmed">
            {stamp}
          </Text>
        </Group>
        <Group gap={10} ml="auto" wrap="wrap">
          <Button
            variant="default"
            leftSection={<RefreshCw size={16} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            Add runner
          </Button>
        </Group>
      </Group>

      <DataTable
        table={table}
        minWidth={900}
        emptyMessage="No plugin runners registered."
        isPending={isPending}
        isError={isError}
        onRetry={() => refetch()}
        loadingMessage="Loading runners…"
      />

      {/* Add runner modal */}
      <Modal
        opened={addOpen}
        onClose={() => {
          setAddOpen(false)
          addForm.reset()
        }}
        title="Register a plugin runner"
        size="md"
      >
        <form
          onSubmit={addForm.onSubmit((values) => createMutation.mutate(values))}
        >
          <Stack gap="md">
            <TextInput
              label="Runner ID"
              description="Unique identifier for this runner"
              required
              {...addForm.getInputProps('id')}
            />
            <TextInput
              label="Name"
              description="Human-readable label"
              {...addForm.getInputProps('name')}
            />
            <TextInput
              label="Base URL"
              description="Runner's gRPC endpoint (optional)"
              placeholder="https://runner.example.com"
              {...addForm.getInputProps('base_url')}
            />
            <Group justify="flex-end">
              <Button
                type="submit"
                loading={createMutation.isPending}
              >
                Register runner
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Enrollment token modal */}
      <EnrollTokenModal
        token={enrollToken}
        open={enrollToken !== null}
        onClose={() => setEnrollToken(null)}
      />
    </Box>
  )
}
