import { Box, Button, Text } from '@mantine/core'
import type { KBPage } from './model'

export function PageListItem({
  page,
  active,
  onSelect,
}: {
  page: KBPage
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
