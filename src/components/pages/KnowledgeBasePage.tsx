import {
  createKnowledgeBasePage,
  kbKeys,
  knowledgeBaseQueryOptions,
  updateKnowledgeBasePage,
} from '#/components/KnowledgeBase/knowledgeBaseQueries'
import type { KnowledgeBaseBlock } from '#/components/KnowledgeBase/knowledgeBaseQueries'
import classes from '#/components/Cases/CasesPage.module.css'
import { Tag } from '#/components/Tag/Tag'
import {
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { DocumentBlock } from './knowledge-base/DocumentBlock'
import { fromApi } from './knowledge-base/model'
import type { KBPage } from './knowledge-base/model'
import { PageListItem } from './knowledge-base/PageListItem'

export function KnowledgeBasePage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    knowledgeBaseQueryOptions(),
  )
  const pages = (data?.items ?? []).map(fromApi)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selectedPage =
    pages.find((p) => p.id === selectedId) ?? pages[0] ?? null

  const addMutation = useMutation({
    mutationFn: () =>
      createKnowledgeBasePage({
        title: 'New page',
        summary: 'New page - start writing...',
        tags: ['draft'],
        blocks: [{ type: 'paragraph', text: 'New page - start writing...' }],
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      setSelectedId(created.id)
      notifications.show({ color: 'teal', message: 'Page created' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to create page',
      }),
  })

  const [showEdit, setShowEdit] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editBlocksJson, setEditBlocksJson] = useState('')

  const openEditor = (page: KBPage) => {
    setEditTitle(page.title)
    setEditSummary(page.summary)
    setEditTags(page.tags.join(', '))
    setEditBlocksJson(JSON.stringify(page.blocks, null, 2))
    setShowEdit(true)
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      let blocks: KnowledgeBaseBlock[]
      try {
        blocks = JSON.parse(editBlocksJson)
      } catch {
        throw new Error('Blocks must be valid JSON')
      }
      return updateKnowledgeBasePage(selectedPage.id, {
        title: editTitle,
        summary: editSummary,
        tags: editTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        blocks,
      })
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: kbKeys.all })
      setShowEdit(false)
      const page = fromApi(updated)
      notifications.show({ color: 'teal', message: `"${page.title}" saved` })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to save page',
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
            pages.map((page) => (
              <PageListItem
                key={page.id}
                page={page}
                active={page.id === selectedId}
                onSelect={() => setSelectedId(page.id)}
              />
            ))
          )}
        </Paper>

        {selectedPage ? (
          <Paper radius="md" p={26} shadow="sm" miw={0} mih={520}>
            <Group justify="flex-end" mb={6}>
              <Button
                variant="default"
                size="xs"
                leftSection={<Pencil size={13} />}
                onClick={() => openEditor(selectedPage)}
              >
                Edit page
              </Button>
            </Group>
            <Stack gap={14} maw={920}>
              <Group gap={6}>
                {selectedPage.tags.map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </Group>
              <Title order={2} fz={22}>
                {selectedPage.title}
              </Title>
              {selectedPage.summary && (
                <Text c="var(--desc)" fz={15} maw="74ch" lh={1.6}>
                  {selectedPage.summary}
                </Text>
              )}
              <Box>
                {selectedPage.blocks.map((block, index) => (
                  <DocumentBlock key={`${block.type}-${index}`} block={block} />
                ))}
              </Box>
            </Stack>
          </Paper>
        ) : (
          <Paper radius="md" p={26} shadow="sm" miw={0} mih={520}>
            <Text c="dimmed" ta="center" mt="xl">
              No pages to display.
            </Text>
          </Paper>
        )}
      </Box>

      <Modal
        opened={showEdit}
        onClose={() => setShowEdit(false)}
        title={`Edit “${selectedPage?.title ?? ''}”`}
        size="lg"
      >
        <Stack gap="md">
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
          <TextInput
            label="Tags"
            description="Comma-separated, e.g. runbook, phishing"
            value={editTags}
            onChange={(e) => setEditTags(e.currentTarget.value)}
          />
          <Textarea
            label="Blocks"
            description="JSON array of blocks"
            value={editBlocksJson}
            onChange={(e) => setEditBlocksJson(e.currentTarget.value)}
            minRows={8}
            styles={{
              input: {
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 12,
              },
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button
              color="orange"
              loading={updateMutation.isPending}
              disabled={!editTitle.trim()}
              onClick={() => updateMutation.mutate()}
            >
              Save changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
