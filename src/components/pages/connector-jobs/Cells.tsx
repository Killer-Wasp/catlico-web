import type {
  ConnectorJob,
  ConnectorJobVerdict,
} from '#/components/Connectors/connectorJobs.types'
import { Badge, Group, Loader, Text } from '@mantine/core'
import { STATUS_COLOR, VERDICT_COLOR } from './constants'

export function StatusPill({ job }: { job: ConnectorJob }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Badge
        variant="light"
        color={STATUS_COLOR[job.status]}
        radius="sm"
        ff="monospace"
        size="sm"
        leftSection={
          job.status === 'running' ? (
            <Loader size={12} type="oval" />
          ) : undefined
        }
      >
        {job.status}
      </Badge>
      {job.cached && (
        <Badge variant="default" radius="sm" ff="monospace" size="sm">
          cached
        </Badge>
      )}
    </Group>
  )
}

export function ObservableCell({ job }: { job: ConnectorJob }) {
  return (
    <Group gap={10} wrap="nowrap" miw={0}>
      <Badge
        variant="default"
        radius="sm"
        ff="monospace"
        size="sm"
        tt="lowercase"
        style={{ flexShrink: 0 }}
      >
        {job.observableType}
      </Badge>
      <Text fw={600} truncate>
        {job.observable}
      </Text>
    </Group>
  )
}

export function VerdictCell({ verdict }: { verdict?: ConnectorJobVerdict }) {
  if (!verdict) {
    return (
      <Text component="span" ff="monospace" c="dimmed">
        -
      </Text>
    )
  }

  return (
    <Badge
      variant="light"
      color={VERDICT_COLOR[verdict]}
      radius="sm"
      ff="monospace"
      size="sm"
    >
      {verdict}
    </Badge>
  )
}
