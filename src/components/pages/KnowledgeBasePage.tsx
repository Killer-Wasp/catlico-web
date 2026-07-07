import {
  createKnowledgeBasePage,
  deleteKnowledgeBasePage,
  fetchKnowledgeBasePageVersions,
  kbKeys,
  knowledgeBaseQueryOptions,
  revertKnowledgeBasePage,
  updateKnowledgeBasePage,
} from '#/components/KnowledgeBase/knowledgeBaseQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { Tag } from '#/components/Tag/Tag'
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Menu,
  Paper,
  Pill,
  PillsInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { RichTextEditor } from '@mantine/tiptap'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
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
import { History, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RichTextField } from './case-template-editor/RichTextField'
import { fromApi } from './knowledge-base/model'
import type { KBPage } from './knowledge-base/model'
import { PageListItem } from './knowledge-base/PageListItem'
import kbStyles from './knowledge-base/styles.module.css'

function KnowledgeBaseTagsInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const [search, setSearch] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setSearch('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((current) => current !== tag))
  }

  return (
    <PillsInput
      label="Tags"
      description="Type a tag and press Enter"
    >
      <Pill.Group>
        {value.map((tag) => (
          <Pill key={tag} withRemoveButton onRemove={() => removeTag(tag)}>
            {tag}
          </Pill>
        ))}
        <PillsInput.Field
          value={search}
          placeholder={value.length === 0 ? 'e.g. runbook, phishing' : ''}
          onChange={(event) => setSearch(event.currentTarget.value)}
          onBlur={() => {
            if (search.trim()) addTag(search)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag(search)
              return
            }
            if (
              event.key === 'Backspace' &&
              search.length === 0 &&
              value.length > 0
            ) {
              event.preventDefault()
              const lastTag = value[value.length - 1]
              if (lastTag) removeTag(lastTag)
            }
          }}
        />
      </Pill.Group>
    </PillsInput>
  )
}

function KnowledgeBaseContent({ content }: { content: string }) {
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
    content,
    contentType: 'markdown',
    editable: false,
    immediatelyRender: false,
  })

  useEffect(() => {
    editor?.commands.setContent(content, { contentType: 'markdown' })
  }, [editor, content])

  if (!content.trim()) {
    return (
      <Text c="dimmed" fs="italic">
        No content yet.
      </Text>
    )
  }

  return (
    <RichTextEditor
      editor={editor}
      styles={{ root: { border: 'none' }, content: { padding: 0 } }}
    >
      <RichTextEditor.Content />
    </RichTextEditor>
  )
}

export function KnowledgeBasePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pageId } = useParams({ strict: false })
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    knowledgeBaseQueryOptions(),
  )
  const pages = (data?.items ?? []).map(fromApi)
  const routePageId = pageId ? Number(pageId) : null

  const selectedPage =
    pages.find((p) => p.id === routePageId) ??
    (pages.length > 0 ? pages[0] : undefined)
  const selectedTabValue = selectedPage ? String(selectedPage.id) : null

  const addMutation = useMutation({
    mutationFn: () =>
      createKnowledgeBasePage({
        title: 'New page',
        summary: 'New page - start writing...',
        tags: ['draft'],
        content: 'New page - start writing...',
    }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      void navigate({
        to: '/knowledge-base/$pageId',
        params: { pageId: String(created.id) },
      })
      notifications.show({ color: 'teal', message: 'Page created' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to create page',
      }),
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editContent, setEditContent] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [previewVersionId, setPreviewVersionId] = useState<number | null>(null)

  const openEditor = (page: KBPage) => {
    setEditTitle(page.title)
    setEditSummary(page.summary)
    setEditTags(page.tags)
    setEditContent(page.content)
    setEditingId(page.id)
  }

  const closeEditor = () => {
    setEditingId(null)
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPage) throw new Error('No page selected')
      return updateKnowledgeBasePage(selectedPage.id, {
        title: editTitle,
        summary: editSummary,
        tags: editTags,
        content: editContent,
      })
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      setEditingId(null)
      const page = fromApi(updated)
      notifications.show({ color: 'teal', message: `"${page.title}" saved` })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to save page',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (page: KBPage) => {
      await deleteKnowledgeBasePage(page.id)
      return page
    },
    onSuccess: (deletedPage) => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      setEditingId(null)
      const fallbackPage = pages.find((page) => page.id !== deletedPage.id)
      if (fallbackPage) {
        void navigate({
          to: '/knowledge-base/$pageId',
          params: { pageId: String(fallbackPage.id) },
        })
      } else {
        void navigate({ to: '/knowledge-base' })
      }
      notifications.show({
        color: 'teal',
        message: `"${deletedPage.title}" deleted`,
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to delete page',
      }),
  })

  const versionsQuery = useQuery({
    queryKey: selectedPage ? kbKeys.versions(selectedPage.id) : [...kbKeys.all, 'versions', 'none'],
    queryFn: () => {
      if (!selectedPage) return Promise.resolve([])
      return fetchKnowledgeBasePageVersions(selectedPage.id)
    },
    enabled: timelineOpen && Boolean(selectedPage),
  })

  const revertMutation = useMutation({
    mutationFn: async (versionId: number) => {
      if (!selectedPage) throw new Error('No page selected')
      return revertKnowledgeBasePage(selectedPage.id, versionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      if (selectedPage) {
        queryClient.invalidateQueries({ queryKey: kbKeys.versions(selectedPage.id) })
      }
      notifications.show({ color: 'teal', message: 'Page reverted' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to revert page',
      }),
  })

  if (isError) {
    return (
      <Box className={classes.page}>
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load knowledge base pages.</Text>
          <Button
            variant="default"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Stack>
      </Box>
    )
  }

  const isEditingSelectedPage = selectedPage?.id === editingId
  const previewVersion =
    versionsQuery.data?.find((version) => version.id === previewVersionId) ??
    null

  return (
    <Box className={classes.page}>
      <Group align="baseline" gap={16} mb={26} wrap="wrap">
        <Title order={1}>Knowledge base</Title>
        <Text ff="monospace" fz={12} c="var(--faint)">
          runbooks, IR procedures &amp; intel notes · org-shared
        </Text>
        <Button
          ml="auto"
          variant="default"
          loading={addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          + New page
        </Button>
      </Group>

      <Tabs
        orientation="vertical"
        value={selectedTabValue}
        onChange={(value) => {
          if (!value) return
          void navigate({
            to: '/knowledge-base/$pageId',
            params: { pageId: value },
          })
        }}
        styles={{ root: { display: 'block' } }}
      >
        <Box className={classes.knowledgeLayout}>
          <Paper radius="md" p={0} shadow="sm" maw={{ md: 360 }}>
            <Group
              gap={10}
              px={18}
              py={14}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Text fz={15} fw={700}>
                Pages
              </Text>
              <Text
                component="span"
                ff="monospace"
                fz={11}
                c="var(--muted)"
                bg="gray.0"
                px={8}
                py={2}
                style={{ borderRadius: 99 }}
              >
                {pages.length}
              </Text>
            </Group>
            {isPending ? (
              <Text c="dimmed" ta="center" py={40}>
                Loading...
              </Text>
            ) : pages.length === 0 ? (
              <Text c="dimmed" ta="center" py={40}>
                No pages yet.
              </Text>
            ) : (
              <Tabs.List
                aria-label="Knowledge base pages"
                styles={{
                  list: {
                    display: 'block',
                    border: 0,
                  },
                }}
              >
                {pages.map((page) => (
                  <PageListItem
                    key={page.id}
                    page={page}
                    active={page.id === selectedPage?.id}
                  />
                ))}
              </Tabs.List>
            )}
          </Paper>

          {selectedPage ? (
          <Paper
            className={kbStyles.detailPanel}
            data-testid="knowledge-base-detail-panel"
            radius="md"
            shadow="sm"
            miw={0}
            mih={520}
          >
            {isEditingSelectedPage ? (
              <Stack gap="md" maw={920}>
                <Group justify="space-between" align="center">
                  <Title order={2} fz={22}>
                    Edit page
                  </Title>
                  <Group gap="xs">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={closeEditor}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      color="orange"
                      size="xs"
                      loading={updateMutation.isPending}
                      disabled={!editTitle.trim()}
                      onClick={() => updateMutation.mutate()}
                    >
                      Save changes
                    </Button>
                  </Group>
                </Group>
                <TextInput
                  label="Title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.currentTarget.value)}
                  required
                />
                <TextInput
                  label="Summary"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.currentTarget.value)}
                />
                <KnowledgeBaseTagsInput
                  value={editTags}
                  onChange={setEditTags}
                />
                <RichTextField
                  label="Content"
                  value={editContent}
                  onChange={setEditContent}
                />
              </Stack>
            ) : (
              <>
                <Stack gap={14} maw={920}>
                  <Group justify="space-between" align="flex-start" gap="md">
                    <Title order={2} fz={22}>
                      {selectedPage.title}
                    </Title>
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          aria-label="Page actions"
                          variant="default"
                          size="sm"
                          loading={deleteMutation.isPending}
                        >
                          <MoreHorizontal size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<History size={14} />}
                          onClick={() => {
                            setPreviewVersionId(null)
                            setTimelineOpen(true)
                          }}
                        >
                          Timeline
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Pencil size={14} />}
                          onClick={() => openEditor(selectedPage)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<Trash2 size={14} />}
                          onClick={() => deleteMutation.mutate(selectedPage)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <Group gap={6}>
                    {selectedPage.tags.map((tag) => (
                      <Tag key={tag} label={tag} />
                    ))}
                  </Group>
                  {selectedPage.lastEditedBy && (
                    <Text c="dimmed" size="xs">
                      Edited by {selectedPage.lastEditedBy.email}
                    </Text>
                  )}
                  {selectedPage.summary && (
                    <Text c="dimmed" data-dimmed="true" size="sm" maw="74ch" lh={1.5}>
                      {selectedPage.summary}
                    </Text>
                  )}
                  <Box>
                    <KnowledgeBaseContent content={selectedPage.content} />
                  </Box>
                </Stack>
              </>
            )}
          </Paper>
        ) : (
          <Paper
            className={kbStyles.detailPanel}
            radius="md"
            shadow="sm"
            miw={0}
            mih={520}
          >
            <Text c="dimmed" ta="center" mt="xl">
              No pages to display.
            </Text>
          </Paper>
        )}
        </Box>
      </Tabs>

      <Drawer
        opened={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        title="Timeline"
        position="right"
        size="lg"
      >
        <Stack gap="md">
          {versionsQuery.isPending ? (
            <Text c="dimmed">Loading timeline...</Text>
          ) : versionsQuery.data?.length ? (
            versionsQuery.data.map((version) => (
              <Paper key={version.id} withBorder p="sm" radius="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={700}>Version {version.version_number}</Text>
                    <Text size="sm" c="dimmed">
                      {version.action} by {version.edited_by_email}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Changed: {version.changed_fields.join(', ') || 'no fields'}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => setPreviewVersionId(version.id)}
                    >
                      View version {version.version_number}
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<RotateCcw size={14} />}
                      loading={revertMutation.isPending}
                      onClick={() => revertMutation.mutate(version.id)}
                    >
                      Revert version {version.version_number}
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))
          ) : (
            <Text c="dimmed">No timeline entries yet.</Text>
          )}

          {previewVersion && (
            <>
              <Divider />
              <Stack gap="sm">
                <Title order={3} fz={18}>
                  {previewVersion.snapshot.title}
                </Title>
                <Group gap={6}>
                  {previewVersion.snapshot.tags.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </Group>
                {previewVersion.snapshot.summary && (
                  <Text c="dimmed" size="sm">
                    {previewVersion.snapshot.summary}
                  </Text>
                )}
                <KnowledgeBaseContent content={previewVersion.snapshot.content} />
              </Stack>
            </>
          )}
        </Stack>
      </Drawer>

    </Box>
  )
}
