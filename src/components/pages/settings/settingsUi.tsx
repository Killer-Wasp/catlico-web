import type { ReactNode } from 'react'
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useEffect, useState } from 'react'
import type { Role } from '#/components/pages/settings/settingsData'

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

export function notifySuccess(message: string) {
  notifications.show({ color: 'green', message })
}

export function notifyError(error: unknown, fallback: string) {
  notifications.show({
    color: 'red',
    message: error instanceof Error ? error.message : fallback,
  })
}

// Guarded clipboard write that resolves to whether the copy succeeded, so callers
// only report success when it actually happened. `navigator.clipboard` is undefined
// on insecure (non-localhost HTTP) origins and can reject, so never assume success.
export async function copyToClipboard(value: string): Promise<boolean> {
  // `navigator.clipboard` is typed as always-present but is actually undefined on
  // insecure origins and can reject, so let the try/catch handle both.
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

// Shared confirmation dialog for destructive actions. Relies on ModalsProvider,
// which SettingsLayout mounts around the settings subtree.
export function confirmDelete({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
}) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm,
  })
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

export function ErrorPanel({
  label = "Couldn't load this section.",
  onRetry,
  retrying,
}: {
  label?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <Paper radius="md" shadow="sm" p="xl">
      <Stack align="center" gap="sm">
        <Text c="red.7">{label}</Text>
        {onRetry && (
          <Button variant="default" loading={retrying} onClick={onRetry}>
            Retry
          </Button>
        )}
      </Stack>
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
