/**
 * PluginVersionsTab — the plugin config drawer's Versions tab (read-only).
 *
 * Since the venv redesign (WP4) plugins are provisioned into the runner's
 * `/plugins` directory at IMAGE BUILD, not installed at runtime — there is no
 * in-app install/upgrade action any more. This tab therefore shows the installed
 * version / source / runner info read-only, and when the best-effort update
 * check reports a newer version it explains how to apply it at build time
 * (`plugin-runner install <source>` + rebuild/restart the runner image).
 *
 * Two independent queries so the (usually "unknown") update check never blocks
 * the installed-version view:
 *   - GET plugins/{id}/versions          → installed metadata + runner list
 *   - GET plugins/{id}/versions/check-latest → best-effort update check
 */
import {
  Anchor,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import { AlertTriangle, ArrowUpCircle, Check, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  pluginVersionsQueryOptions,
  pluginVersionCheckQueryOptions,
} from '#/components/Plugins/plugins'
import type { PluginVersionRunnerPublic } from '#/components/Plugins/plugins.types'
import { localDateTimeLabel } from '#/components/Time/RelativeTime'

function runnerStatusColor(status: string): string {
  return status === 'healthy'
    ? 'green'
    : status === 'unhealthy'
      ? 'orange'
      : 'gray'
}

function RunnerRow({ runner }: { runner: PluginVersionRunnerPublic }) {
  return (
    <Group gap="xs" justify="space-between" wrap="nowrap">
      <Text fz={13} fw={500}>
        {runner.name || runner.id}
      </Text>
      <Badge variant="dot" color={runnerStatusColor(runner.status)} size="sm">
        {runner.status || 'unknown'}
      </Badge>
    </Group>
  )
}

/**
 * Build-time upgrade guidance — shown in place of the removed in-app upgrade
 * action. Plugins are baked into the runner image, so an upgrade is an infra
 * step, not an API call.
 */
function BuildTimeUpgradeGuidance({ sourceUrl }: { sourceUrl: string | null }) {
  return (
    <Stack gap={4}>
      <Text fz={13}>
        Upgrades are applied at image build. Provision the new version into the
        runner and restart it:
      </Text>
      <Code block fz={12}>
        {`plugin-runner install ${sourceUrl || '<source>'}\nplugin-runner sync   # then rebuild / restart the runner image`}
      </Code>
    </Stack>
  )
}

export function PluginVersionsTab({ pluginId }: { pluginId: string }) {
  const { data, isLoading, isError, refetch } = useQuery(
    pluginVersionsQueryOptions(pluginId),
  )
  const check = useQuery(pluginVersionCheckQueryOptions(pluginId))

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

      {/* Update check — read-only; upgrades happen at image build */}
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
          <Stack gap={8}>
            <Group gap="xs" wrap="nowrap">
              <ArrowUpCircle size={16} color="var(--mantine-color-yellow-filled)" />
              <Text fz={13} fw={600}>
                Update available
                {check.data?.latest_version ? `: ${check.data.latest_version}` : ''}
              </Text>
            </Group>
            <BuildTimeUpgradeGuidance sourceUrl={data.source_url} />
          </Stack>
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
