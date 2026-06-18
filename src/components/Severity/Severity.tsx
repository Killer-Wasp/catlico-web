import type { MantineColor } from '@mantine/core'
import { Box, Flex, Text } from '@mantine/core'
import type { Severity } from '#/lib/domain'
import { SEV } from '#/lib/domain'

// Severity name → Mantine theme colour. Passed to the `c`/`bg` props so
// the heat bar and label track the active theme palette.
const SEV_COLOR: Record<string, MantineColor> = {
  critical: 'red.6',
  high: 'orange.6',
  medium: 'yellow.6',
  low: 'blue.6',
}

type SeverityIdProps = {
  /** Case/alert identifier, e.g. "AL-9123" or "#1842". */
  id: string
  sev: Severity
}

/**
 * Alert/case identifier prefixed with a severity heat bar and an
 * uppercase severity label. Shared by the Alerts and Cases tables so
 * the two read identically. Colours come from the Mantine theme palette.
 */
export function Severity({ id, sev }: SeverityIdProps) {
  const sevName = SEV[sev]
  const color = SEV_COLOR[sevName]
  return (
    <Flex gap={10}>
      <Box
        w={4}
        bg={color}
        style={{ borderRadius: '0 3px 3px 0', alignSelf: 'stretch' }}
      />
      <div>
        <Text
          ff="monospace"
          fz={11.5}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        >
          {id}
        </Text>
        <Text ff="monospace" fz={10} fw={600} lts="0.5px" mt={2} c={color}>
          {sevName.toUpperCase()}
        </Text>
      </div>
    </Flex>
  )
}
