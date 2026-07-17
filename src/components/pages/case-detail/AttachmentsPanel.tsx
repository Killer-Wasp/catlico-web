import type { CaseDetailAttachment } from '#/components/Cases/caseDetails.types'
import {
  caseAttachmentsQueryOptions,
  deleteCaseAttachment,
  downloadCaseAttachment,
  invalidateAttachmentQueries,
  uploadCaseAttachment,
} from '#/components/Cases/casesQueries'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Stack,
  Text,
} from '@mantine/core'
import { AppDrawer } from '#/components/ui/AppDrawer'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Download, EllipsisVertical, Info, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { actionNotice } from './constants'
import styles from './styles.module.css'

export function AttachmentsPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dropZoneRef = useRef<HTMLDivElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [infoAttachment, setInfoAttachment] =
    useState<CaseDetailAttachment | null>(null)

  const { data: attachments = [] } = useQuery(
    caseAttachmentsQueryOptions(caseId),
  )

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCaseAttachment(caseId, file),
    onSuccess: () => {
      invalidateAttachmentQueries(queryClient, caseId)
    },
    onError: () => actionNotice('Upload failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: number) => deleteCaseAttachment(caseId, linkId),
    onSuccess: () => {
      invalidateAttachmentQueries(queryClient, caseId)
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

  const columns = useMemo<ColumnDef<CaseDetailAttachment>[]>(
    () => [
      {
        id: 'file',
        header: 'File',
        meta: { grow: true } satisfies TableColumnMeta,
        cell: ({ row }) => {
          const file = row.original
          return (
            <Group gap="sm" wrap="nowrap">
              <Box className={styles.attachmentKind}>
                <Text ff="monospace" fz={10} fw={700} c="dimmed">
                  {file.kind}
                </Text>
              </Box>
              <Box flex={1} miw={0}>
                <Text fw={600} truncate>
                  {file.name}
                </Text>
                <Text ff="monospace" fz={12} c="dimmed" truncate>
                  {file.size} &middot; {file.time}
                </Text>
              </Box>
            </Group>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
        cell: ({ row }) => {
          const file = row.original
          return (
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
                  leftSection={<Info size={14} />}
                  onClick={() => setInfoAttachment(file)}
                >
                  Show info
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
          )
        },
      },
    ],
    [caseId, deleteMutation.isPending],
  )

  const table = useReactTable({
    data: attachments,
    columns,
    getRowId: (row) => String(row.linkId),
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Stack gap="md" p="lg">
      <AppDrawer
        opened={infoAttachment !== null}
        onClose={() => setInfoAttachment(null)}
        title={infoAttachment ? `${infoAttachment.name} info` : 'Attachment info'}
      >
        {infoAttachment ? (
          <Stack gap="sm">
            <AttachmentInfoRow label="Size" value={infoAttachment.size} />
            <AttachmentInfoRow label="SHA-256" value={infoAttachment.sha256} />
            <AttachmentInfoRow
              label="Uploaded date"
              value={infoAttachment.time}
            />
            <AttachmentInfoRow
              label="Uploaded by"
              value={infoAttachment.author}
            />
          </Stack>
        ) : null}
      </AppDrawer>

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

      <TablePanel
        title="Attachments"
        countNoun="files"
        table={table}
        withFilterBar={false}
        withPagination={false}
        titleExtra={
          <Text ff="monospace" fz={11} c="dimmed">
            drag &amp; drop or paste &middot; hashed on upload (SHA-256)
          </Text>
        }
        actions={
          <Button
            variant="default"
            size="xs"
            leftSection={<Upload size={14} />}
            loading={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload file
          </Button>
        }
      >
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
          <DataTable
            table={table}
            minWidth={480}
            ariaLabel="Case attachments"
            emptyMessage="No attachments for this case."
          />
        </Box>
      </TablePanel>
    </Stack>
  )
}

function AttachmentInfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <Box>
      <Text className={styles.fieldLabel} mb={4}>
        {label}
      </Text>
      <Text className={styles.attachmentInfoValue}>{value}</Text>
    </Box>
  )
}
