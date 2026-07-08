import { Box } from '@mantine/core'
import { X } from 'lucide-react'
import classes from './Tag.module.css'

type TagProps = {
  /** Tag label, e.g. "T1059" or "phishing". */
  label: string
  size?: 'xs' | 'sm'
  tone?:
    | 'neutral'
    | 'status'
    | 'severity'
    | 'tlp'
    | 'pap'
    | 'assignee'
    | 'taxonomy'
  onRemove?: () => void
  removeLabel?: string
}

const isMitreTag = (tag: string) => /^T\d/.test(tag)

/**
 * Monospace tag chip used in the Alerts and Cases tables. MITRE ATT&CK
 * tags (detected via {@link isMitreTag}) are tinted with the `--mitre`
 * accent; everything else uses the neutral muted palette.
 */
export function Tag({
  label,
  size = 'sm',
  tone = 'neutral',
  onRemove,
  removeLabel,
}: TagProps) {
  const mitre = isMitreTag(label)
  const toneClass = tone === 'neutral' ? '' : ` ${classes[tone]}`
  const sizeClass = size === 'xs' ? '' : ` ${classes[size]}`
  return (
    <Box
      className={`${classes.tag}${sizeClass}${toneClass}${mitre ? ` ${classes.mitre}` : ''}`}
      data-size={size}
      data-tag-tone={tone}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          className={classes.remove}
          aria-label={removeLabel ?? `Remove ${label}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
        >
          <X size={11} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
    </Box>
  )
}
