import { Badge, Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { SlaState } from './cases.types'

dayjs.extend(relativeTime)

const STATE_COLOR: Record<Exclude<SlaState, null>, string> = {
  ok: 'green',
  'at-risk': 'yellow',
  breached: 'red',
}

const STATE_LABEL: Record<Exclude<SlaState, null>, string> = {
  ok: 'SLA',
  'at-risk': 'SLA at risk',
  breached: 'SLA breached',
}

/**
 * Resolve-SLA chip for a case. Colour encodes the state; the label shows the
 * time remaining ("due in 4h") or overrun ("2h ago"). Renders nothing when the
 * case has no live SLA (`state` null or no due time) so callers can drop it in
 * unconditionally.
 */
export function SlaChip({
  state,
  dueAt,
  size = 'sm',
}: {
  state: SlaState
  dueAt: string | null
  size?: string
}) {
  if (!state || !dueAt) return null
  const relative = dayjs(dueAt).fromNow()
  return (
    <Tooltip
      label={`Resolve SLA due ${dayjs(dueAt).format('DD MMM YYYY, h:mm A')}`}
      withArrow
    >
      <Badge
        color={STATE_COLOR[state]}
        variant="light"
        radius="sm"
        size={size}
        ff="monospace"
      >
        {STATE_LABEL[state]} {relative}
      </Badge>
    </Tooltip>
  )
}
