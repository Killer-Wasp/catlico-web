import { Box } from '@mantine/core'

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
    <Box
      ff="monospace"
      fz={10}
      style={(theme) => ({
        padding: '1px 7px',
        borderRadius: 4,
        color: mitre ? 'var(--mitre)' : 'var(--muted)',
        border: mitre
          ? '1px solid color-mix(in srgb, var(--mitre) 35%, transparent)'
          : `1px solid light-dark(${theme.colors.gray[3]}, ${theme.colors.dark[4]})`,
        background: `light-dark(${theme.colors.gray[0]}, ${theme.colors.dark[6]})`,
      })}
    >
      {label}
    </Box>
  )
}
