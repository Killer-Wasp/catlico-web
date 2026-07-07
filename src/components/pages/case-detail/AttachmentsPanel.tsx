import type { CaseDetailAttachment } from '#/components/Cases/caseDetails.types'
import {
  caseKeys,
  deleteCaseAttachment,
  downloadCaseAttachment,
  uploadCaseAttachment,
} from '#/components/Cases/casesQueries'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, EllipsisVertical, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import { actionNotice } from './constants'
import styles from './styles.module.css'

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

  // paste handler on the attachment area
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
    <Stack gap="md" p="lg">
      <CasePanelHeader label="Attachments" />

      <Box
        ref={dropZoneRef}
        className={`${styles.attachmentsDropZone} ${
          dragOver ? styles.attachmentsDropZoneActive : ''
        }`}
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
      >
        <Group
          className={styles.attachmentsUploadHeader}
          gap="md"
          justify="space-between"
          wrap="nowrap"
        >
          <Text ff="monospace" fz={12} c="dimmed">
            drag &amp; drop or paste &middot; hashed on upload (SHA-256)
          </Text>
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
            className={styles.attachmentsFileInput}
            onChange={(event) => {
              const f = event.currentTarget.files?.[0]
              if (f) uploadMutation.mutate(f)
              event.currentTarget.value = ''
            }}
          />
        </Group>

        {attachments.map((file) => (
          <Group
            key={file.linkId}
            className={styles.attachmentRow}
            gap="sm"
            wrap="nowrap"
            py={12}
          >
            <Paper
              withBorder
              radius="sm"
              bg="gray.0"
              w={40}
              h={40}
              className={styles.attachmentKind}
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
            <Menu position="bottom-end" withinPortal withArrow shadow="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Attachment actions for ${file.name}`}
                  loading={deleteMutation.isPending}
                >
                  <EllipsisVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Download size={14} />}
                  onClick={() => handleDownload(file)}
                >
                  Download
                </Menu.Item>
                <Menu.Item
                  color="red"
                  disabled={deleteMutation.isPending}
                  leftSection={<Trash2 size={14} />}
                  onClick={() => deleteMutation.mutate(file.linkId)}
                >
                  Remove
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ))}
      </Box>
    </Stack>
  )
}
