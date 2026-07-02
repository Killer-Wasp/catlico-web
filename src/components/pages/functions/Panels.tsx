import { Badge, Group, Paper, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function FuncPanel({
  title,
  badge,
  right,
  children,
}: {
  title: string
  badge?: string
  right?: ReactNode
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
          {badge ? (
            <Badge variant="default" color="gray" radius="xl" ff="monospace">
              {badge}
            </Badge>
          ) : null}
        </Group>
        {right}
      </Group>
      {children}
    </Paper>
  )
}

export function PageHead({
  title,
  stamp,
  actions,
}: {
  title: string
  stamp: string
  actions: ReactNode
}) {
  return (
    <Group justify="space-between" align="center" mb="xl" wrap="nowrap">
      <Group gap="md" align="baseline">
        <Title order={1}>{title}</Title>
        <Text ff="monospace" fz="sm" c="dimmed" lts="0.6px">
          {stamp}
        </Text>
      </Group>
      <Group gap="sm" wrap="nowrap">
        {actions}
      </Group>
    </Group>
  )
}
