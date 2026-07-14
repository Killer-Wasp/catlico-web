import { avatarFor } from '#/components/Cases/cases'
import type { MentionUser } from './mentionSuggestion'
import {
  mentionableUsersQueryOptions,
  mentionSuggestion,
} from './mentionSuggestion'
import {
  caseCommentsQueryOptions,
  createCaseComment,
  deleteCaseComment,
  invalidateCommentQueries,
  updateCaseComment,
} from '#/components/Cases/casesQueries'
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Menu,
  ScrollArea,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mention } from '@tiptap/extension-mention'
import { Markdown } from '@tiptap/markdown'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import { actionNotice } from './constants'

/** Transient class applied to a comment deep-linked via `?comment=`. */
export const COMMENT_HIGHLIGHT_CLASS = 'comment-highlight'
const HIGHLIGHT_MS = 2000

export function CommentsPanel({
  caseId,
  highlightCommentId,
}: {
  caseId: string
  /** When set (from `?comment=`), scroll that comment into view and briefly
   *  highlight it once it's present in the list. */
  highlightCommentId?: string
}) {
  const queryClient = useQueryClient()
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const highlightedForRef = useRef<string | null>(null)

  const { data: comments = [] } = useQuery(
    caseCommentsQueryOptions(caseId, sortOrder),
  )

  // Scroll to and flash the deep-linked comment once — but only after the
  // list has loaded and actually contains it. Guarded by a ref so a comment
  // refetch doesn't re-trigger the flash for the same target.
  useEffect(() => {
    if (!highlightCommentId) return
    if (highlightedForRef.current === highlightCommentId) return
    if (!comments.some((c) => c.id === highlightCommentId)) return
    const el = document.getElementById(`comment-${highlightCommentId}`)
    if (!el) return
    highlightedForRef.current = highlightCommentId
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(highlightCommentId)
  }, [highlightCommentId, comments])

  // The clear-timeout lives in its own effect keyed on `highlightedId` so its
  // lifecycle is independent of `comments`: a refetch mid-window must not tear
  // down and (via the ref guard) fail to re-arm the timer, which would leave
  // the highlight stuck on forever.
  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightedId])

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => deleteCaseComment(commentId),
    onSuccess: () => {
      invalidateCommentQueries(queryClient, caseId)
    },
  })

  const editingComment = editingCommentId
    ? comments.find((c) => c.id === editingCommentId)
    : null

  return (
    <Stack gap={0} p="lg">
      <CasePanelHeader
        label="Comments"
        action={
          <Select
            aria-label="Sort comments"
            size="xs"
            w={150}
            value={sortOrder}
            data={[
              { value: 'desc', label: 'Newest first' },
              { value: 'asc', label: 'Oldest first' },
            ]}
            allowDeselect={false}
            onChange={(value) =>
              setSortOrder(value === 'asc' ? 'asc' : 'desc')
            }
          />
        }
      />

      <CaseCommentEditor
        caseId={caseId}
        editingComment={
          editingComment
            ? { id: editingComment.id, body: editingComment.body }
            : null
        }
        onEditDone={() => setEditingCommentId(null)}
      />

      {comments.map((comment, index) => {
        const [initials, color] = avatarFor(comment.author)
        const isHighlighted = comment.id === highlightedId
        return (
          <Group
            key={comment.id}
            id={`comment-${comment.id}`}
            className={isHighlighted ? COMMENT_HIGHLIGHT_CLASS : undefined}
            gap="sm"
            align="flex-start"
            wrap="nowrap"
            py="md"
            px={isHighlighted ? 'sm' : undefined}
            style={{
              transition: 'background-color 300ms ease',
              borderRadius: isHighlighted ? 8 : undefined,
              backgroundColor: isHighlighted
                ? 'var(--mantine-color-yellow-light)'
                : undefined,
              ...(index < comments.length - 1
                ? { borderBottom: '1px solid var(--line-soft)' }
                : {}),
            }}
          >
            <Avatar size={32} radius="xl" bg={color} c="white">
              {initials}
            </Avatar>
            <Box flex={1} miw={0}>
              <Group gap={8} mb={4}>
                <Text fw={700}>{comment.author}</Text>
                <Text ff="monospace" fz={12} c="dimmed">
                  {comment.time} AEST
                </Text>
              </Group>
              <Text c="var(--desc)">{comment.body}</Text>
            </Box>
            <Menu shadow="md" width={120}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <Pencil size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<Pencil size={14} />}
                  onClick={() => setEditingCommentId(comment.id)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<Trash2 size={14} />}
                  color="red"
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )
      })}
    </Stack>
  )
}

function CaseCommentEditor({
  caseId,
  editingComment,
  onEditDone,
}: {
  caseId: string
  editingComment?: { id: string; body: string } | null
  onEditDone?: () => void
}) {
  const [empty, setEmpty] = useState(true)
  const [posting, setPosting] = useState(false)
  const { data: mentionUsers } = useQuery(mentionableUsersQueryOptions())
  const usersRef = useRef<MentionUser[]>([])
  const queryClient = useQueryClient()
  const editIdRef = useRef<string | null>(null)

  useEffect(() => {
    usersRef.current = mentionUsers ?? []
  }, [mentionUsers])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Mention.configure({
        suggestion: mentionSuggestion(() => usersRef.current),
      }),
    ],
    content: '',
    contentType: 'markdown',
    immediatelyRender: false,
    onCreate: ({ editor: activeEditor }) => setEmpty(activeEditor.isEmpty),
    onUpdate: ({ editor: activeEditor }) => setEmpty(activeEditor.isEmpty),
    editorProps: {
      attributes: {
        'aria-label': editingComment ? 'Edit comment' : 'Add a comment',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          save()
          return true
        }
        return false
      },
    },
  })

  // Populate editor when entering edit mode or clear when leaving it
  useEffect(() => {
    if (!editor) return
    const prevId = editIdRef.current
    editIdRef.current = editingComment?.id ?? null
    if (editingComment && editingComment.id !== prevId) {
      editor.commands.setContent(editingComment.body, {
        contentType: 'markdown',
      })
    } else if (!editingComment && prevId) {
      editor.commands.clearContent()
      setEmpty(true)
    }
  }, [editor, editingComment])

  async function save() {
    if (!editor || editor.isEmpty || posting) return
    const markdown = editor.getMarkdown()
    if (!markdown.trim()) return
    setPosting(true)
    try {
      if (editingComment) {
        await updateCaseComment(editingComment.id, markdown)
        actionNotice('Comment updated')
        onEditDone?.()
      } else {
        await createCaseComment(caseId, markdown)
        actionNotice('Comment posted')
        editor.commands.clearContent()
        setEmpty(true)
      }
      invalidateCommentQueries(queryClient, caseId)
    } catch {
      actionNotice(
        editingComment ? 'Failed to update comment' : 'Failed to post comment',
      )
    } finally {
      setPosting(false)
    }
  }

  return (
    <Stack gap="sm" pt="md">
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.ClearFormatting />
            <RichTextEditor.Code />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
            <RichTextEditor.CodeBlock />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
          {editingComment && (
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              onClick={() => onEditDone?.()}
              ml="auto"
            >
              Cancel
            </Button>
          )}
          <Button
            color="orange"
            size="xs"
            onClick={save}
            disabled={empty}
            ml={editingComment ? undefined : 'auto'}
          >
            {editingComment ? 'Save comment' : 'Post comment'}
          </Button>
        </RichTextEditor.Toolbar>
        <ScrollArea h={120}>
          <RichTextEditor.Content />
        </ScrollArea>
      </RichTextEditor>
    </Stack>
  )
}
