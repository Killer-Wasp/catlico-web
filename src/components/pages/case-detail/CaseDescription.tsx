import { Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { RichTextEditor } from '@mantine/tiptap'
import { Emoji, gitHubEmojis } from '@tiptap/extension-emoji'
import { Mention } from '@tiptap/extension-mention'
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
import { useQuery } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { ListChecks, Pencil, Table as TableIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  mentionableUsersQueryOptions,
  mentionSuggestion,
} from './mentionSuggestion'
import type { MentionUser } from './mentionSuggestion'
import styles from './styles.module.css'

// Mono, uppercase, dimmed inline field label — matches the detail page's other
// section labels.
const labelProps = {
  ff: 'monospace',
  fz: 10,
  lts: '0.8px',
  tt: 'uppercase',
  c: 'dimmed',
} as const

type CaseDescriptionProps = {
  /** Saved description as Markdown (CommonMark). */
  markdown: string
  /** Persist the edited Markdown; rejects on failure so the editor stays open. */
  onSave: (markdown: string) => Promise<void>
}

/**
 * The case description, rendered and edited with Tiptap, stored as Markdown.
 * The editor parses/serialises Markdown via `@tiptap/markdown` (`contentType:
 * 'markdown'` + `editor.getMarkdown()`), so the backend keeps its CommonMark
 * contract. Read-only by default (a borderless Tiptap view — the content is
 * rendered through the schema, never `dangerouslySetInnerHTML`); the Edit
 * button reveals the toolbar editor with explicit Save / Cancel.
 */
export function CaseDescription({ markdown, onSave }: CaseDescriptionProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Org members feed the @-mention picker. Held in a ref so the suggestion
  // (created once with the editor) always reads the latest list.
  const { data: mentionUsers } = useQuery(mentionableUsersQueryOptions())
  const usersRef = useRef<MentionUser[]>([])
  useEffect(() => {
    usersRef.current = mentionUsers ?? []
  }, [mentionUsers])

  const editor = useEditor({
    // StarterKit covers the basics (paragraph, text, headings, code block,
    // lists, list items, horizontal rule, etc.); the rest add tables, task
    // lists, @mentions and :emoji: on top.
    extensions: [
      StarterKit,
      Markdown,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      // @-mention picker backed by the org's members.
      Mention.configure({
        suggestion: mentionSuggestion(() => usersRef.current),
      }),
      Emoji.configure({ emojis: gitHubEmojis, enableEmoticons: true }),
    ],
    content: markdown,
    contentType: 'markdown',
    editable: false,
    // TanStack Start renders on the server first; defer the editor's initial
    // render to the client to avoid a hydration mismatch.
    immediatelyRender: false,
  })

  // Keep the editor in sync with the saved value when it changes externally
  // (e.g. a refetch after save) and we're not mid-edit.
  useEffect(() => {
    if (editor && !editing) {
      editor.commands.setContent(markdown, { contentType: 'markdown' })
    }
  }, [editor, markdown, editing])

  const startEditing = () => {
    editor?.setEditable(true)
    setEditing(true)
    editor?.commands.focus('end')
  }

  const cancel = () => {
    editor?.commands.setContent(markdown, { contentType: 'markdown' })
    editor?.setEditable(false)
    setEditing(false)
  }

  const save = async () => {
    if (!editor) return
    setSaving(true)
    try {
      // Treat an editor with no real content as an empty description.
      const next = editor.isEmpty ? '' : editor.getMarkdown()
      await onSave(next)
      editor.setEditable(false)
      setEditing(false)
    } catch (error) {
      const message =
        isHTTPError(error) && error.response.status === 403
          ? "You don't have permission to edit this case."
          : 'Could not save the description. Please try again.'
      notifications.show({ color: 'red', message })
    } finally {
      setSaving(false)
    }
  }

  const isEmpty = !markdown.trim()

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text {...labelProps}>Description</Text>
        {!editing && (
          <Button
            variant="subtle"
            color="gray"
            size="compact-xs"
            leftSection={<Pencil size={13} />}
            onClick={startEditing}
          >
            Edit
          </Button>
        )}
      </Group>

      {!editing && isEmpty ? (
        <Text fz={14} c="dimmed" fs="italic">
          No description yet.
        </Text>
      ) : (
        <RichTextEditor
          editor={editor}
          className={!editing ? styles.caseDescriptionReadOnly : undefined}
          data-testid={!editing ? 'case-description-read-mode' : undefined}
          // In read mode strip the editor chrome so it reads as plain content.
          styles={
            editing
              ? undefined
              : { root: { border: 'none' }, content: { padding: 0 } }
          }
        >
          {editing && (
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
          )}
          <RichTextEditor.Content />
        </RichTextEditor>
      )}

      {editing && (
        <Group gap="xs">
          <Button size="xs" onClick={save} loading={saving}>
            Save
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </Group>
      )}
    </Stack>
  )
}
