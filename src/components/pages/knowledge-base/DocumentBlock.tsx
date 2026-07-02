import type { KnowledgeBaseBlock } from '#/components/KnowledgeBase/knowledgeBaseQueries'
import { Box, Code, Text, Title } from '@mantine/core'

function ParagraphBlock({
  block,
}: {
  block: Extract<KnowledgeBaseBlock, { type: 'paragraph' }>
}) {
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

export function DocumentBlock({ block }: { block: KnowledgeBaseBlock }) {
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
