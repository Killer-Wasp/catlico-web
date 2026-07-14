import { Text, Tooltip } from '@mantine/core'
import { Paperclip } from 'lucide-react'
import type { ObservableAttachment } from '#/components/Observables/observables.types'

/** Human-readable byte size: `512 B`, `2 KB`, `5.0 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Small paperclip shown on list rows for file-backed observables. The accessible
 * name carries the filename so the row still announces the attachment; the
 * drawer chip is the primary place to actually download it.
 */
export function ObservableFileIndicator({
  attachment,
}: {
  attachment: ObservableAttachment
}) {
  return (
    <Tooltip label={attachment.filename} withArrow>
      <Text
        component="span"
        role="img"
        aria-label={`Has file: ${attachment.filename}`}
        c="dimmed"
        style={{ display: 'inline-flex', verticalAlign: 'middle' }}
      >
        <Paperclip size={13} aria-hidden />
      </Text>
    </Tooltip>
  )
}
