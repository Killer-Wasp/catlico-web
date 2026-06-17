import type { CaseStatus } from '#/components/Cases/casesData'
import type { MantineColor } from '@mantine/core'
import { Badge } from '@mantine/core'

// Case status → Mantine theme colour, driving the light badge tint.
const STATUS_COLOR: Record<CaseStatus, MantineColor> = {
  new: 'violet',
  open: 'blue',
  inprogress: 'yellow',
  waiting: 'gray',
  resolved: 'green',
  duplicated: 'gray',
}

type StatusBadgeProps = {
  status: CaseStatus
  /** Human-readable status label, e.g. "In progress". */
  label: string
}

/**
 * Light status badge shared by the Alerts and Cases tables, colour-coded
 * by case status via the Mantine theme palette.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge color={STATUS_COLOR[status]} variant="light" radius="sm" size="sm">
      {label}
    </Badge>
  )
}
