import { Box, Tabs, Text } from '@mantine/core'
import type { KBPage } from './model'

export function PageListItem({
  page,
  active,
}: {
  page: KBPage
  active: boolean
}) {
  return (
    <Tabs.Tab
      value={String(page.id)}
      h="auto"
      px={18}
      py={12}
      ta="left"
      style={(theme) => ({
        width: '100%',
        justifyContent: 'flex-start',
        borderRadius: 0,
        borderBottom: '1px solid var(--line-soft)',
        background: active
          ? `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`
          : undefined,
      })}
    >
      <Box w="100%" ta="left">
        <Text fw={700} fz={14} c={active ? 'orange.7' : 'var(--text)'}>
          {page.title}
        </Text>
        <Text ff="monospace" fz={10.5} c="var(--faint)" mt={4}>
          {page.author} · updated {page.updated}
        </Text>
      </Box>
    </Tabs.Tab>
  )
}
