import { Badge, Group, Paper, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function Panel({
  title,
  badge,
  action,
  children,
}: {
  title: string
  badge?: string | number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper
      withBorder
      radius="md"
      shadow="sm"
      bg="body"
      style={{ overflow: 'hidden' }}
    >
      <Group
        justify="space-between"
        px="lg"
        py="md"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Group gap="sm">
          <Title order={2} size="h4">
            {title}
          </Title>
          {badge !== undefined ? (
            <Badge variant="default" color="gray" radius="xl" ff="monospace">
              {badge}
            </Badge>
          ) : null}
        </Group>
        {action}
      </Group>
      {children}
    </Paper>
  )
}
