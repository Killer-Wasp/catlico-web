import { Box } from '@mantine/core'
import { X } from 'lucide-react'
import classes from './Tag.module.css'

type TagProps = {
  /** Tag label, e.g. "T1059" or "phishing". */
  label: string
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
  tone = 'neutral',
  onRemove,
  removeLabel,
}: TagProps) {
  const mitre = isMitreTag(label)
  const toneClass = tone === 'neutral' ? '' : ` ${classes[tone]}`
  return (
    <Box
      className={`${classes.tag}${toneClass}${mitre ? ` ${classes.mitre}` : ''}`}
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
