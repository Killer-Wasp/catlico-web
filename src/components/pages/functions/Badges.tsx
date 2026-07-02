import { Badge } from '@mantine/core'
import type { FunctionTrigger } from './model'

export function TriggerBadge({ trigger }: { trigger: FunctionTrigger }) {
  const color =
    trigger === 'event'
      ? 'violet'
      : trigger === 'scheduled'
        ? 'blue'
        : trigger === 'manual'
          ? 'yellow'
          : 'green'

  return (
    <Badge
      variant="light"
      color={color}
      radius="sm"
      size="sm"
      ff="monospace"
      tt="lowercase"
    >
      {trigger}
    </Badge>
  )
}

export function ProfileBadge({ profile }: { profile: string }) {
  const color = profile === 'read-only' ? 'gray' : 'blue'
  return (
    <Badge
      variant="light"
      color={color}
      radius="xl"
      size="md"
      ff="monospace"
      tt="lowercase"
      w={170}
      styles={{ label: { textTransform: 'none' } }}
    >
      {profile}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="light"
      color={status === 'success' ? 'lime' : 'red'}
      radius="sm"
      size="sm"
      ff="monospace"
      tt="lowercase"
    >
      {status}
    </Badge>
  )
}
