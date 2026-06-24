import { Box } from '@mantine/core'
import classes from './Tag.module.css'

type TagProps = {
  /** Tag label, e.g. "T1059" or "phishing". */
  label: string
}

const isMitreTag = (tag: string) => /^T\d/.test(tag)

/**
 * Monospace tag chip used in the Alerts and Cases tables. MITRE ATT&CK
 * tags (detected via {@link isMitreTag}) are tinted with the `--mitre`
 * accent; everything else uses the neutral muted palette.
 */
export function Tag({ label }: TagProps) {
  const mitre = isMitreTag(label)
  return (
    <Box className={`${classes.tag}${mitre ? ` ${classes.mitre}` : ''}`}>
      {label}
    </Box>
  )
}
