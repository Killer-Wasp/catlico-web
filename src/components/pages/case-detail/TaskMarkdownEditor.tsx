import { Badge, Box, Button, Group } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import FileHandler from '@tiptap/extension-file-handler'
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ListChecks, Paperclip, Table as TableIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function TaskMarkdownEditor({
  initialMarkdown,
  saveLabel,
  ariaLabel,
  saving = false,
  files,
  onFilesChange,
  onSave,
}: {
  initialMarkdown: string
  saveLabel: string
  ariaLabel: string
  saving?: boolean
  files?: File[]
  onFilesChange?: (files: File[]) => void
  onSave: (markdown: string) => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<File[]>(files ?? [])
  const onFilesChangeRef = useRef<typeof onFilesChange>(onFilesChange)

  useEffect(() => {
    filesRef.current = files ?? []
    onFilesChangeRef.current = onFilesChange
  }, [files, onFilesChange])

  const appendFiles = (nextFiles: File[]) => {
    if (!onFilesChangeRef.current || !nextFiles.length) return
    onFilesChangeRef.current([...filesRef.current, ...nextFiles])
  }
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      ...(onFilesChange
        ? [
            FileHandler.configure({
              onDrop: (_editor, droppedFiles) => appendFiles(droppedFiles),
              onPaste: (_editor, pastedFiles) => appendFiles(pastedFiles),
            }),
          ]
        : []),
    ],
    content: initialMarkdown,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
      },
    },
  })

  useEffect(() => {
    editor?.commands.setContent(initialMarkdown, { contentType: 'markdown' })
  }, [editor, initialMarkdown])

  const save = async () => {
    if (!editor) return
    await onSave(editor.isEmpty ? '' : editor.getMarkdown())
  }

  return (
    <RichTextEditor editor={editor}>
      <RichTextEditor.Toolbar>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Code />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />
          <RichTextEditor.Control
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            active={editor?.isActive('taskList')}
            aria-label="Task list"
            title="Task list"
          >
            <ListChecks size={16} />
          </RichTextEditor.Control>
          <RichTextEditor.Blockquote />
          <RichTextEditor.CodeBlock />
        </RichTextEditor.ControlsGroup>
        <RichTextEditor.ControlsGroup>
          <RichTextEditor.Control
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            aria-label="Insert table"
            title="Insert table"
          >
            <TableIcon size={16} />
          </RichTextEditor.Control>
          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
        </RichTextEditor.ControlsGroup>
        {onFilesChange ? (
          <Box ml="auto">
            <RichTextEditor.Control
              aria-label="Attach files"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={16} />
            </RichTextEditor.Control>
          </Box>
        ) : (
          <Box ml="auto" />
        )}
        <Button
          size="compact-xs"
          color="orange"
          loading={saving}
          onClick={save}
        >
          {saveLabel}
        </Button>
      </RichTextEditor.Toolbar>
      {onFilesChange ? (
        <input
          ref={fileInputRef}
          aria-label={
            ariaLabel === 'Add work log'
              ? 'Work log attachments'
              : `${ariaLabel} file picker`
          }
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => {
            appendFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
      ) : null}
      <RichTextEditor.Content />
      {files?.length ? (
        <Group gap={6} p="xs" wrap="wrap">
          {files.map((file) => (
            <Badge
              key={`${file.name}-${file.size}`}
              variant="default"
              radius="sm"
              leftSection={<Paperclip size={12} />}
            >
              {file.name}
            </Badge>
          ))}
        </Group>
      ) : null}
    </RichTextEditor>
  )
}
