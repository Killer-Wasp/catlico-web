import { Badge } from '@mantine/core'

type StatusBadgeProps = {
  /** Human-readable status label, e.g. "In progress". */
  label: string
  /** Badge colour (hex) from the org's case-status lookup. */
  color?: string | null
}

const FALLBACK_COLOR = '#6b7280'

/**
 * Light status badge shared by the Cases table, case detail and search hits.
 * Colour comes from the org-scoped case-status lookup (`case_status.color`),
 * not a static map — so custom statuses render with their configured colour.
 */
export function StatusBadge({ label, color }: StatusBadgeProps) {
  const c = color || FALLBACK_COLOR
  return (
    <Badge
      variant="light"
      radius="sm"
      size="sm"
      styles={{
        root: { backgroundColor: `${c}22`, color: c },
      }}
    >
      {label}
    </Badge>
  )
}
