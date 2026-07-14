/**
 * PluginVersionsTab — the plugin config drawer's Versions tab (v1).
 *
 * Two independent queries so the (usually "unknown") update check never blocks
 * the installed-version view:
 *   - GET plugins/{id}/versions          → installed metadata + runner list
 *   - GET plugins/{id}/versions/check-latest → best-effort update check
 *
 * Upgrade reuses the existing install flow (POST plugin-runners/{id}/plugins/
 * install) — one call per runner the plugin is on. The API responds 202 and the
 * runner reports install progress back asynchronously; we invalidate the
 * metadata query so the runner rows reflect the new install_status.
 */
import {
  Anchor,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AlertTriangle, ArrowUpCircle, Check, RefreshCw } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  pluginKeys,
  pluginVersionsQueryOptions,
  pluginVersionCheckQueryOptions,
  installPluginOnRunner,
} from '#/components/Plugins/plugins'
import type { PluginVersionRunnerPublic } from '#/components/Plugins/plugins.types'
import { localDateTimeLabel } from '#/components/Time/RelativeTime'
import { errorMessage } from '#/lib/ui-helpers'

function runnerStatusColor(status: string): string {
  return status === 'healthy'
    ? 'green'
    : status === 'unhealthy'
      ? 'orange'
      : 'gray'
}

function installStatusColor(status: string): string {
  if (status === 'installed' || status === 'active') return 'green'
  if (status === 'failed') return 'red'
  return 'blue' // installing / pending / anything in-flight
}

function RunnerRow({ runner }: { runner: PluginVersionRunnerPublic }) {
  return (
    <Group gap="xs" justify="space-between" wrap="nowrap">
      <Text fz={13} fw={500}>
        {runner.name || runner.id}
      </Text>
      <Group gap={6} wrap="nowrap">
        <Badge variant="dot" color={runnerStatusColor(runner.status)} size="sm">
          {runner.status || 'unknown'}
        </Badge>
        {runner.install_status && (
          <Badge
            variant="light"
            color={installStatusColor(runner.install_status)}
            size="sm"
            radius="sm"
          >
            {runner.install_status}
          </Badge>
        )}
      </Group>
    </Group>
  )
}

export function PluginVersionsTab({ pluginId }: { pluginId: string }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery(
    pluginVersionsQueryOptions(pluginId),
  )
  const check = useQuery(pluginVersionCheckQueryOptions(pluginId))

  const upgrade = useMutation({
    mutationFn: async () => {
      const runners = data?.runners ?? []
      const source_url = data?.source_url
      // Defend the invariant: never trigger an install without a real source.
      // `update_available` implies a source in v1, but if that ever breaks we
      // must not silently POST an empty URL → a garbage/failing install.
      if (!source_url) {
        throw new Error('Cannot upgrade: plugin has no source URL')
      }
      const source_ref = data.source_ref ?? 'main'
      // Upgrade every runner the plugin is installed on. `allSettled` so one
      // runner's failure doesn't discard the successes on the others.
      const results = await Promise.allSettled(
        runners.map((runner) =>
          installPluginOnRunner(runner.id, {
            plugin_id: pluginId,
            source_url,
            source_ref,
          }),
        ),
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      return { succeeded, total: runners.length }
    },
    onSuccess: ({ succeeded, total }) => {
      const failed = total - succeeded
      if (succeeded === 0) {
        notifications.show({
          color: 'red',
          message: `Upgrade failed on all ${total} runner${total === 1 ? '' : 's'}`,
        })
        return
      }
      notifications.show({
        color: failed > 0 ? 'yellow' : 'green',
        message:
          failed > 0
            ? `Upgrade started on ${succeeded} of ${total} runners; ${failed} failed`
            : 'Upgrade started',
      })
      // Any success means at least one runner is now (re)installing — repaint.
      queryClient.invalidateQueries({ queryKey: pluginKeys.versions(pluginId) })
      check.refetch()
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: `Upgrade failed: ${errorMessage(error)}`,
      }),
  })

  if (isLoading) {
    return (
      <Group gap="xs" py="md">
        <Loader size="sm" />
        <Text fz={14} c="dimmed">
          Loading version info…
        </Text>
      </Group>
    )
  }

  if (isError || !data) {
    return (
      <Stack gap="xs" py="md">
        <Text fz={14} c="red">
          Couldn’t load version info.
        </Text>
        <Button
          variant="default"
          size="xs"
          leftSection={<RefreshCw size={14} />}
          onClick={() => refetch()}
          style={{ alignSelf: 'flex-start' }}
        >
          Retry
        </Button>
      </Stack>
    )
  }

  const installed = data.installed_version !== null
  const shortSha = data.commit_sha ? data.commit_sha.slice(0, 7) : null
  const checkStatus = check.data?.status

  return (
    <Stack gap="lg">
      {/* Installed version */}
      <Stack gap={4}>
        <Text fz={12} c="dimmed" tt="uppercase" fw={600}>
          Installed version
        </Text>
        {installed ? (
          <Group gap="xs">
            <Badge variant="light" color="blue" radius="sm" size="lg">
              {data.installed_version}
            </Badge>
            {data.status && (
              <Text fz={13} c="dimmed">
                {data.status}
              </Text>
            )}
          </Group>
        ) : (
          <Text fz={14} c="dimmed">
            Not installed
          </Text>
        )}
      </Stack>

      {/* Source */}
      {installed && data.source_url && (
        <Stack gap={4}>
          <Text fz={12} c="dimmed" tt="uppercase" fw={600}>
            Source
          </Text>
          <Anchor href={data.source_url} target="_blank" rel="noreferrer" fz={13}>
            {data.source_url}
          </Anchor>
          <Text fz={13} c="dimmed">
            {data.source_ref ? `ref ${data.source_ref}` : null}
            {data.source_ref && shortSha ? ' · ' : null}
            {shortSha ? `commit ${shortSha}` : null}
          </Text>
        </Stack>
      )}

      {/* Installed at */}
      {installed && data.installed_at && (
        <Stack gap={4}>
          <Text fz={12} c="dimmed" tt="uppercase" fw={600}>
            Installed
          </Text>
          <Text fz={13}>{localDateTimeLabel(data.installed_at)}</Text>
        </Stack>
      )}

      {/* Runners */}
      {installed && (
        <Stack gap={6}>
          <Text fz={12} c="dimmed" tt="uppercase" fw={600}>
            Runners
          </Text>
          {data.runners.length === 0 ? (
            <Text fz={13} c="dimmed">
              Not installed on any runner.
            </Text>
          ) : (
            <Stack gap={6}>
              {data.runners.map((runner) => (
                <RunnerRow key={runner.id} runner={runner} />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {/* Update check */}
      <Stack gap={6}>
        <Group gap="xs" justify="space-between">
          <Text fz={12} c="dimmed" tt="uppercase" fw={600}>
            Updates
          </Text>
          <Button
            variant="subtle"
            size="compact-xs"
            leftSection={<RefreshCw size={12} />}
            loading={check.isFetching}
            onClick={() => check.refetch()}
          >
            Check for update
          </Button>
        </Group>

        {check.isLoading ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text fz={13} c="dimmed">
              Checking…
            </Text>
          </Group>
        ) : checkStatus === 'update_available' ? (
          <Group gap="sm" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <ArrowUpCircle size={16} color="var(--mantine-color-yellow-filled)" />
              <Text fz={13} fw={600}>
                Update available
                {check.data?.latest_version ? `: ${check.data.latest_version}` : ''}
              </Text>
            </Group>
            {installed && data.source_url && data.runners.length > 0 && (
              <Button
                size="xs"
                color="yellow"
                leftSection={<ArrowUpCircle size={14} />}
                loading={upgrade.isPending}
                onClick={() => upgrade.mutate()}
              >
                Upgrade
              </Button>
            )}
          </Group>
        ) : checkStatus === 'up_to_date' ? (
          <Group gap="xs">
            <Check size={16} color="var(--mantine-color-green-filled)" />
            <Text fz={13}>
              Up to date
              {check.data?.latest_version ? ` (${check.data.latest_version})` : ''}
            </Text>
          </Group>
        ) : (
          // `unknown` — the normal v1 state (no registry yet). Not an error.
          <Group gap="xs">
            <AlertTriangle size={14} color="var(--mantine-color-gray-5)" />
            <Text fz={13} c="dimmed">
              Update status unavailable
            </Text>
          </Group>
        )}
      </Stack>
    </Stack>
  )
}
