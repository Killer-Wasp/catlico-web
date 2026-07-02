import { Box, Text } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji'
import {
  Table as TiptapTable,
  TableCell,
  TableHeader,
  TableRow,
} from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ListChecks, Table as TableIcon } from 'lucide-react'
import { useEffect } from 'react'

export function RichTextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (markdown: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      TiptapTable.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Emoji.configure({ emojis: gitHubEmojis, enableEmoticons: true }),
    ],
    content: value,
    contentType: 'markdown',
    // TanStack Start renders on the server first; defer the editor's initial
    // render to the client to avoid a hydration mismatch.
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? '' : instance.getMarkdown())
    },
  })

  useEffect(() => {
    if (editor && editor.getMarkdown() !== value) {
      editor.commands.setContent(value, { contentType: 'markdown' })
    }
  }, [editor, value])

  return (
    <Box>
      <Text fw={500} size="sm" mb={4}>
        {label}
      </Text>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar sticky stickyOffset={60}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
            <RichTextEditor.Code />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
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
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content />
      </RichTextEditor>
    </Box>
  )
}
