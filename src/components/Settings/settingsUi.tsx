import type { ReactNode } from 'react'
import {
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import type { IntegrationState, Role } from '#/components/Settings/settingsData'

export function useStamp() {
  const [stamp, setStamp] = useState('')

  useEffect(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Australia/Sydney',
    })
    const time = now
      .toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
      })
      .toLowerCase()
    setStamp(`${date}, ${time} AEST`)
  }, [])

  return stamp
}

export function notify(message: string) {
  notifications.show({ color: 'orange', message })
}

export function compactDate(iso: string | null | undefined) {
  if (!iso) return 'never'
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function toOrgShortName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <Paper radius="md" shadow="sm" p="xl">
      <Group justify="center" gap="xs">
        <Loader size="sm" />
        <Text c="dimmed">{label}</Text>
      </Group>
    </Paper>
  )
}

export function SettingsSectionButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      fz={13}
      fw={600}
      c={active ? 'var(--text)' : 'var(--muted)'}
      px={12}
      py={8}
      style={(theme) => ({
        borderRadius: theme.radius.md,
        background: active
          ? `light-dark(${theme.colors.gray[1]}, ${theme.colors.dark[6]})`
          : undefined,
      })}
    >
      {label}
    </UnstyledButton>
  )
}

export function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Paper radius="md" shadow="sm" p={0}>
      <Group
        px={18}
        py={14}
        wrap="nowrap"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <Title order={2} fz={15}>
          {title}
        </Title>
        {count !== undefined && (
          <Badge variant="default" color="gray" radius="xl" ff="monospace">
            {count}
          </Badge>
        )}
        {action && <Group ml="auto">{action}</Group>}
      </Group>
      {children}
    </Paper>
  )
}

export function TableBox({ children }: { children: ReactNode }) {
  return <Box style={{ overflowX: 'auto' }}>{children}</Box>
}

export function RoleBadge({ role }: { role: Role | string }) {
  const color =
    role === 'admin' || role === 'org-admin'
      ? 'orange'
      : role === 'readonly' || role === 'read-only'
        ? 'gray'
        : 'blue'

  return (
    <Badge color={color} variant="light" radius="xl" ff="monospace">
      {role.toUpperCase()}
    </Badge>
  )
}

export function StatusBadge({ state }: { state: IntegrationState | string }) {
  return (
    <Badge
      color={state === 'AUTH ERROR' || state === 'PAUSED' ? 'red' : 'green'}
      variant="light"
      radius="xl"
      ff="monospace"
    >
      {state}
    </Badge>
  )
}
