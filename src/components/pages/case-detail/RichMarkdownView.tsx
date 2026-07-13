import { Text } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
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

/**
 * RichMarkdownView — read-only Markdown renderer for task descriptions and work
 * logs. Same safe path as `CaseDescription`: a borderless, read-only Tiptap view
 * whose extension set matches the task editor (StarterKit + tables + task lists),
 * so anything the analyst can write round-trips and renders identically here.
 * Content is rendered through the ProseMirror schema, never
 * `dangerouslySetInnerHTML`.
 */
export function RichMarkdownView({
  markdown,
  fz = 14,
}: {
  markdown: string
  fz?: number
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: markdown,
    contentType: 'markdown',
    editable: false,
    // TanStack Start renders on the server first; defer to the client to avoid a
    // hydration mismatch (same as CaseDescription / MarkdownView).
    immediatelyRender: false,
  })

  // Before the editor mounts on the client, fall back to plain text so the
  // content is never missing and never rendered as raw HTML.
  if (!editor) {
    return (
      <Text fz={fz} style={{ whiteSpace: 'pre-wrap' }}>
        {markdown}
      </Text>
    )
  }

  return (
    <RichTextEditor
      editor={editor}
      styles={{
        root: { border: 'none' },
        content: { padding: 0, background: 'transparent', fontSize: fz },
      }}
    >
      <RichTextEditor.Content />
    </RichTextEditor>
  )
}
