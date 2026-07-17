import { Badge, Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { MfaSection } from '#/components/pages/settings/panels/MfaSection'
import { LinkedIdentitiesSection } from '#/components/pages/settings/panels/LinkedIdentitiesSection'
import { DataTable } from '#/components/Table/DataTable'
import {
  revokeSession,
  sessionsQueryOptions,
  settingsKeys,
} from '#/components/pages/settings/settingsQueries'
import type { SessionPublic } from '#/components/pages/settings/settingsQueries'
import { logout } from '#/lib/auth/session'
import { redirectToLogin } from '#/lib/auth/redirects'
import {
  compactDate,
  confirmDelete,
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

/**
 * Tiny, best-effort UA → "Browser on OS" formatter. Deliberately simple: this is
 * a human hint next to the session, not a fingerprinting tool. Falls back to the
 * raw UA string when it can't recognise both halves, or "Unknown device" when the
 * server sent no user agent at all. Order matters — Edge/Chrome UAs also contain
 * "Safari", and Chrome UAs contain "Safari", so check the more specific first.
 */
export function formatUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device'

  let browser: string | undefined
  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) browser = 'Edge'
  else if (/\bOPR\/|\bOpera\//.test(ua)) browser = 'Opera'
  else if (/\bChrome\//.test(ua)) browser = 'Chrome'
  else if (/\bFirefox\//.test(ua)) browser = 'Firefox'
  else if (/\bVersion\/.*Safari\//.test(ua) || /\bSafari\//.test(ua))
    browser = 'Safari'

  let os: string | undefined
  if (/\bWindows NT\b/.test(ua)) os = 'Windows'
  else if (/\biPhone\b|\biPad\b|\biPod\b/.test(ua)) os = 'iOS'
  else if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) os = 'macOS'
  else if (/\bAndroid\b/.test(ua)) os = 'Android'
  else if (/\bLinux\b/.test(ua)) os = 'Linux'

  if (browser && os) return `${browser} on ${os}`
  if (browser) return browser
  return ua
}

// Current session first, then most-recently-created first. Revoking is a
// security action, so the session you're using now belongs at the top.
function sortSessions(sessions: SessionPublic[]): SessionPublic[] {
  return [...sessions].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
}

export function SecurityPanel() {
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    sessionsQueryOptions(),
  )

  return (
    <Stack gap="lg">
      <MfaSection />
      <LinkedIdentitiesSection />
      {isPending ? (
        <LoadingPanel label="Loading active sessions..." />
      ) : isError ? (
        <ErrorPanel
          label="Couldn't load active sessions."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : (
        <SessionsTable sessions={sortSessions(data)} />
      )}
    </Stack>
  )
}

// Kept as a child so the table hook stays above the parent's early returns
// (matches ApiKeysPanel's ApiKeysTable split).
function SessionsTable({ sessions }: { sessions: SessionPublic[] }) {
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = useState({})

  const revokeMutation = useMutation({
    // Carry the whole session so onSuccess can honour the confirm's promise:
    // revoking the current session must actually sign the user out, not just
    // drop the row (the in-memory access JWT stays valid until its TTL).
    mutationFn: (session: SessionPublic) => revokeSession(session.id),
    onSuccess: (_data, session) => {
      if (session.is_current) {
        // Make "This will sign you out." true immediately: tear down the local
        // session (posts auth/logout + clearSession) and bounce to login — the
        // same helpers client.ts uses when a refresh fails.
        logout()
        redirectToLogin()
        return
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.sessions() })
      notifySuccess('Session revoked')
    },
    onError: (error) => notifyError(error, 'Unable to revoke session'),
  })

  const bulkRevokeMutation = useMutation({
    // Revoke the other sessions first, then the current one last (if selected),
    // so a mid-batch sign-out can't strand the remaining revokes.
    mutationFn: async (selected: SessionPublic[]) => {
      const current = selected.find((s) => s.is_current)
      const others = selected.filter((s) => !s.is_current)
      await Promise.all(others.map((s) => revokeSession(s.id)))
      if (current) await revokeSession(current.id)
      return { signedOut: Boolean(current) }
    },
    onSuccess: ({ signedOut }) => {
      if (signedOut) {
        logout()
        redirectToLogin()
        return
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.sessions() })
      notifySuccess('Sessions revoked')
      setRowSelection({})
    },
    onError: (error) => notifyError(error, 'Unable to revoke sessions'),
  })

  const askRevoke = (session: SessionPublic) => {
    const device = formatUserAgent(session.user_agent)
    confirmDelete({
      title: 'Revoke session',
      message: session.is_current
        ? `Revoke this session (${device})? This will sign you out.`
        : `Revoke this session (${device})? That device will need to sign in again.`,
      confirmLabel: 'Revoke session',
      onConfirm: () => revokeMutation.mutate(session),
    })
  }

  const askBulkRevoke = (selected: SessionPublic[]) => {
    const includesCurrent = selected.some((s) => s.is_current)
    confirmDelete({
      title: 'Revoke sessions',
      message: includesCurrent
        ? `Revoke ${selected.length} selected sessions? This includes the session you're using, so you'll be signed out.`
        : `Revoke ${selected.length} selected sessions? Those devices will need to sign in again.`,
      confirmLabel: 'Revoke sessions',
      onConfirm: () => bulkRevokeMutation.mutate(selected),
    })
  }

  const columns = useMemo<ColumnDef<SessionPublic>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            size="xs"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            aria-label="Select all sessions"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="xs"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Select session ${row.original.id}`}
          />
        ),
        enableSorting: false,
      },
      {
        id: 'device',
        header: 'Device',
        meta: { grow: true },
        cell: ({ row }) => (
          <Group gap="xs" wrap="nowrap">
            <Text fw={600}>{formatUserAgent(row.original.user_agent)}</Text>
            {row.original.is_current && (
              <Badge color="green" variant="light" radius="xl">
                Current session
              </Badge>
            )}
          </Group>
        ),
      },
      {
        id: 'ip',
        header: 'IP address',
        meta: { nowrap: true },
        cell: ({ row }) => (
          <Text size="sm" c="dimmed" ff="monospace">
            {row.original.ip_address ?? '—'}
          </Text>
        ),
      },
      {
        id: 'signedIn',
        header: 'Signed in',
        meta: { nowrap: true },
        cell: ({ row }) => (
          <Text size="sm" c="var(--faint)">
            {compactDate(row.original.created_at)}
          </Text>
        ),
      },
      {
        id: 'expires',
        header: 'Expires',
        meta: { nowrap: true },
        cell: ({ row }) => (
          <Text size="sm" c="var(--faint)">
            {compactDate(row.original.expires_at)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { ta: 'right' },
        cell: ({ row }) => (
          <Button
            size="xs"
            variant="default"
            color="red"
            loading={
              revokeMutation.isPending &&
              revokeMutation.variables.id === row.original.id
            }
            onClick={() => askRevoke(row.original)}
          >
            Revoke
          </Button>
        ),
      },
    ],
    // Rebuild when the revoke mutation identity changes — the actions cell reads
    // its pending state (matches ApiKeysPanel's columns memo).
    [revokeMutation],
  )

  const table = useReactTable({
    data: sessions,
    columns,
    state: { rowSelection },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableSorting: false,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })

  const selected = table.getSelectedRowModel().rows.map((r) => r.original)

  return (
    <Panel
      title="Active sessions"
      count={sessions.length}
      action={
        selected.length > 0 ? (
          <Button
            size="xs"
            variant="default"
            color="red"
            loading={bulkRevokeMutation.isPending}
            onClick={() => askBulkRevoke(selected)}
          >
            Revoke selected ({selected.length})
          </Button>
        ) : undefined
      }
    >
      <DataTable
        table={table}
        minWidth={680}
        ariaLabel="Active sessions"
        emptyMessage="No active sessions."
        rowTestId={(row) => `session-row-${row.original.id}`}
      />
    </Panel>
  )
}
