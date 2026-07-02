import type { CaseDetailAttachment } from '#/components/Cases/caseDetails.types'
import {
  caseKeys,
  deleteCaseAttachment,
  downloadCaseAttachment,
  uploadCaseAttachment,
} from '#/components/Cases/casesQueries'
import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { actionNotice } from './constants'

export function AttachmentsPanel({
  attachments,
  caseId,
}: {
  attachments: CaseDetailAttachment[]
  caseId: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropZoneRef = useRef<HTMLDivElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCaseAttachment(caseId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
    onError: () => actionNotice('Upload failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: number) => deleteCaseAttachment(caseId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
    onError: () => actionNotice('Delete failed'),
  })

  async function handleDownload(attachment: CaseDetailAttachment) {
    try {
      await downloadCaseAttachment(caseId, attachment.linkId, attachment.name)
    } catch {
      actionNotice(`Download failed for ${attachment.name}`)
    }
  }

  function handleFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) uploadMutation.mutate(f)
  }

  // paste handler on the upload area
  useEffect(() => {
    const el = dropZoneRef.current
    if (!el) return
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData?.files.length) return
      e.preventDefault()
      handleFiles(e.clipboardData.files)
    }
    el.addEventListener('paste', onPaste)
    return () => el.removeEventListener('paste', onPaste)
  }, [caseId])

  return (
    <Stack gap={0} p="lg">
      {attachments.map((file) => (
        <Group
          key={file.linkId}
          gap="sm"
          wrap="nowrap"
          py={12}
          style={{ borderBottom: '1px solid var(--line-soft)' }}
        >
          <Paper
            withBorder
            radius="sm"
            bg="gray.0"
            w={40}
            h={40}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text ff="monospace" fz={10} fw={700} c="dimmed">
              {file.kind}
            </Text>
          </Paper>
          <Box flex={1} miw={0}>
            <Text fw={600} truncate>
              {file.name}
            </Text>
            <Text ff="monospace" fz={12} c="dimmed" truncate>
              {file.size} &middot; sha256 {file.sha256} &middot; {file.author}{' '}
              &middot; {file.time}
            </Text>
          </Box>
          <Button
            variant="default"
            size="xs"
            leftSection={<Download size={14} />}
            onClick={() => handleDownload(file)}
          >
            Download
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<Trash2 size={14} />}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(file.linkId)}
          >
            Delete
          </Button>
        </Group>
      ))}

      <Box
        ref={dropZoneRef}
        pt="md"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: dragOver
            ? '2px dashed var(--mantine-color-orange-5)'
            : '2px dashed transparent',
          borderRadius: 'var(--mantine-radius-sm)',
          transition: 'border 0.15s',
        }}
      >
        <Group gap="md">
          <Button
            variant="default"
            leftSection={<Upload size={16} />}
            loading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload file
          </Button>
          <input
            ref={fileInputRef}
            aria-label="Case attachment file picker"
            type="file"
            style={{ display: 'none' }}
            onChange={(event) => {
              const f = event.currentTarget.files?.[0]
              if (f) uploadMutation.mutate(f)
              event.currentTarget.value = ''
            }}
          />
          <Text ff="monospace" fz={12} c="dimmed">
            drag &amp; drop or paste &middot; hashed on upload (SHA-256)
          </Text>
        </Group>
      </Box>
    </Stack>
  )
}
