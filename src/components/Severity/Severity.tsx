import { Box, Flex, Text } from '@mantine/core'
import type { Severity } from '#/lib/domain'
import { SEV } from '#/lib/domain'
import classes from './Severity.module.css'

type SeverityIdProps = {
  /** Case/alert identifier, e.g. "AL-9123" or "#1842". */
  id: string
  sev: Severity
}

/**
 * Alert/case identifier prefixed with a severity heat bar and an
 * uppercase severity label. Shared by the Alerts and Cases tables so
 * the two read identically. Colours come from the Mantine theme palette
 * via the per-severity `--sev-color` class in Severity.module.css.
 */
export function Severity({ id, sev }: SeverityIdProps) {
  const sevName = SEV[sev]
  return (
    <Flex className={`${classes.root} ${classes[sevName] ?? ''}`}>
      <Box className={classes.bar} />
      <div>
        <Text className={classes.id}>{id}</Text>
        <Text className={classes.label}>{sevName.toUpperCase()}</Text>
      </div>
    </Flex>
  )
}
