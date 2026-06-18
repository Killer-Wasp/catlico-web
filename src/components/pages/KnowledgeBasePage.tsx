import {
  createDraftKnowledgeBasePage,
  getKnowledgeBasePage,
  initialKnowledgeBasePages,
} from '#/components/KnowledgeBase/knowledgeBase'
import type {
  KnowledgeBaseBlock,
  KnowledgeBasePage,
} from '#/components/KnowledgeBase/knowledgeBase.types'
import classes from '#/components/Cases/CasesPage.module.css'
import { Tag } from '#/components/Tag/Tag'
import {
  Box,
  Button,
  Code,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Pencil } from 'lucide-react'
import { useState } from 'react'

function PageListItem({
  page,
  active,
  onSelect,
}: {
  page: KnowledgeBasePage
  active: boolean
  onSelect: () => void
}) {
  return (
    <Button
      variant="subtle"
      color="gray"
      fullWidth
      justify="flex-start"
      radius={0}
      h="auto"
      px={18}
      py={12}
      ta="left"
      onClick={onSelect}
      style={(theme) => ({
        borderBottom: '1px solid var(--line-soft)',
        background: active
          ? `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`
          : undefined,
      })}
    >
      <Box>
        <Text fw={700} fz={14} c={active ? 'orange.7' : 'var(--text)'}>
          {page.title}
        </Text>
        <Text ff="monospace" fz={10.5} c="var(--faint)" mt={4}>
          {page.author} · updated {page.updated}
        </Text>
      </Box>
    </Button>
  )
}

function ParagraphBlock({ block }: { block: Extract<KnowledgeBaseBlock, { type: 'paragraph' }> }) {
  if (block.code) {
    return (
      <Text c="var(--desc)" fz={14} maw="74ch" lh={1.65} mb={10}>
        Apply the <Code>{block.code}</Code> case template to auto-create these
        tasks.
      </Text>
    )
  }

  return (
    <Text c="var(--desc)" fz={14} maw="74ch" lh={1.65} mb={10}>
      {block.text}
    </Text>
  )
}

function DocumentBlock({ block }: { block: KnowledgeBaseBlock }) {
  if (block.type === 'paragraph') {
    return <ParagraphBlock block={block} />
  }

  if (block.type === 'section') {
    return (
      <Box mt={18}>
        <Title order={3} fz={15} mb={6}>
          {block.title}
        </Title>
        <Box component="ul" m={0} pl={22} c="var(--desc)" fz={14}>
          {block.items.map((item) => (
            <Text component="li" key={item} mb={4}>
              {item.includes('.eml') ? (
                <>
                  Pull the raw <Code>.eml</Code> via M365 message trace.
                </>
              ) : (
                item
              )}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box component="ul" m={0} pl={22} c="var(--desc)" fz={14}>
      {block.items.map((item) => (
        <Text component="li" key={item} mb={4}>
          {item}
        </Text>
      ))}
    </Box>
  )
}

export function KnowledgeBasePage() {
  const [pages, setPages] = useState(initialKnowledgeBasePages)
  const [selectedId, setSelectedId] = useState(initialKnowledgeBasePages[0].id)

  const selectedPage = getKnowledgeBasePage(pages, selectedId)

  const addPage = () => {
    const draft = createDraftKnowledgeBasePage('New page')
    setPages((current) => [draft, ...current])
    setSelectedId(draft.id)
    notifications.show({ color: 'teal', message: 'Page created' })
  }

  const editPage = () => {
    notifications.show({ message: `Editing ${selectedPage.title}…` })
  }

  return (
    <Box className={classes.page}>
      <Group align="baseline" gap={16} mb={26} wrap="wrap">
        <Title order={1}>Knowledge base</Title>
        <Text ff="monospace" fz={12} c="var(--faint)">
          runbooks, IR procedures &amp; intel notes · org-shared
        </Text>
        <Button ml="auto" variant="default" onClick={addPage}>
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
          {pages.map((page) => (
            <PageListItem
              key={page.id}
              page={page}
              active={page.id === selectedPage.id}
              onSelect={() => setSelectedId(page.id)}
            />
          ))}
        </Paper>

        <Paper radius="md" p={26} shadow="sm" miw={0} mih={520}>
          <Group justify="flex-end" mb={6}>
            <Button
              variant="default"
              size="xs"
              leftSection={<Pencil size={13} />}
              onClick={editPage}
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
      </Box>
    </Box>
  )
}
