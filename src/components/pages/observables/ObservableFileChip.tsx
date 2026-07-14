import { Box, Button, Group, Text } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { Download, Paperclip } from 'lucide-react'
import { fetchObservableFile } from '#/components/Observables/observablesQueries'
import type { ObservableAttachment } from '#/components/Observables/observables.types'
import { notifyError } from '#/components/pages/settings/settingsUi'
import { formatBytes } from './ObservableFileIndicator'

/**
 * File chip for a file-backed observable: shows the filename + human-readable
 * size and a Download button. The download fetches the bytes *through the api
 * client* (so the bearer + org headers attach), wraps them in a Blob with the
 * declared content type and triggers an `<a download={filename}>` — the token
 * never appears in a URL, unlike a plain `<a href>` to the endpoint.
 */
export function ObservableFileChip({
  observableId,
  attachment,
}: {
  observableId: string
  attachment: ObservableAttachment
}) {
  const download = useMutation({
    mutationFn: () => fetchObservableFile(observableId),
    onSuccess: (data) => {
      const blob = new Blob([data], { type: attachment.content_type })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = attachment.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },
    onError: (error) => notifyError(error, 'Unable to download file'),
  })

  return (
    <Group
      gap="sm"
      wrap="nowrap"
      p="sm"
      style={{
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Paperclip size={16} aria-hidden style={{ flexShrink: 0 }} />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text fz={13} fw={600} truncate>
          {attachment.filename}
        </Text>
        <Text fz={12} c="dimmed">
          {formatBytes(attachment.size)}
        </Text>
      </Box>
      <Button
        size="xs"
        variant="light"
        leftSection={<Download size={14} />}
        loading={download.isPending}
        onClick={() => download.mutate()}
      >
        Download
      </Button>
    </Group>
  )
}
