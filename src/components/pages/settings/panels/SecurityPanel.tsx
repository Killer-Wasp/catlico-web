import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MfaSection } from '#/components/pages/settings/panels/MfaSection'
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

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionPublic
  onRevoke: (session: SessionPublic) => void
  revoking: boolean
}) {
  return (
    <Group
      data-testid={`session-row-${session.id}`}
      justify="space-between"
      wrap="nowrap"
      align="flex-start"
      py="sm"
      style={{ borderBottom: '1px solid var(--line-soft)' }}
    >
      <Stack gap={2} miw={0}>
        <Group gap="xs" wrap="nowrap">
          <Text fw={600}>{formatUserAgent(session.user_agent)}</Text>
          {session.is_current && (
            <Badge color="green" variant="light" radius="xl">
              Current session
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed" ff="monospace">
          {session.ip_address ?? '—'}
        </Text>
        <Text size="xs" c="var(--faint)">
          Signed in {compactDate(session.created_at)} · expires{' '}
          {compactDate(session.expires_at)}
        </Text>
      </Stack>
      <Button
        size="xs"
        variant="default"
        color="red"
        loading={revoking}
        onClick={() => onRevoke(session)}
      >
        Revoke
      </Button>
    </Group>
  )
}

export function SecurityPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    sessionsQueryOptions(),
  )

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

  const sessions = data ? sortSessions(data) : []

  return (
    <Stack gap="lg">
      <MfaSection />
      {isPending ? (
        <LoadingPanel label="Loading active sessions..." />
      ) : isError ? (
        <ErrorPanel
          label="Couldn't load active sessions."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : (
        <Panel title="Active sessions" count={sessions.length}>
          <Stack gap={0} px={18} py={4}>
            {sessions.length === 0 ? (
              <Text c="dimmed" py="md">
                No active sessions.
              </Text>
            ) : (
              sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  revoking={
                    revokeMutation.isPending &&
                    revokeMutation.variables.id === session.id
                  }
                  onRevoke={askRevoke}
                />
              ))
            )}
          </Stack>
        </Panel>
      )}
    </Stack>
  )
}
