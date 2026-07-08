import type { Tlp } from '#/lib/domain'
import { TLP, TLP_COLOR } from '#/lib/domain'
import { Badge } from '@mantine/core'

export function TableTlpBadge({ tlp }: { tlp: Tlp }) {
  const tlpName = TLP[tlp]
  const label = `TLP:${tlpName.toUpperCase()}`

  return (
    <Badge
      aria-label={label}
      title={label}
      color={TLP_COLOR[tlpName]}
      variant="light"
      radius="sm"
      size="sm"
      ff="monospace"
    >
      {tlpName.charAt(0).toUpperCase()}
    </Badge>
  )
}
