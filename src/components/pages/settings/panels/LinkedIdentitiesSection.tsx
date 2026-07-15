import { Button, Group, Stack, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'
import {
  identitiesKeys,
  identitiesQueryOptions,
  unlinkIdentity,
} from '#/lib/auth/identities'
import type { LinkedIdentity } from '#/lib/auth/identities'
import {
  compactDate,
  confirmDelete,
  notify,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

/** True for a ky HTTPError (or a test double) carrying a 409 status. */
function isConflict(error: unknown): boolean {
  const withResponse = error as { response?: { status?: number } }
  return withResponse.response?.status === 409
}

/**
 * Read the server's `detail` off a 409 body. ky pre-parses the JSON into
 * `error.data` (consuming the stream), so prefer that; the "only sign-in method"
 * message lives there.
 */
function conflictDetail(error: unknown): string | null {
  const data = (error as { data?: { detail?: unknown } }).data
  const detail = data?.detail
  return typeof detail === 'string' ? detail : null
}

/**
 * The actual list + unlink UI. Split out so it only mounts (and only then fires
 * `GET /auth/identities`) once the SSO capability gate above has passed — on the
 * OSS build this component never renders, so no identities request is made.
 */
function IdentitiesList() {
  const queryClient = useQueryClient()
  const { data: identities = [] } = useQuery(identitiesQueryOptions())

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: identitiesKeys.list() })

  const unlink = useMutation({
    mutationFn: (id: string) => unlinkIdentity(id),
    onSuccess: () => {
      invalidate()
      notifySuccess('SSO account unlinked')
    },
    onError: (error) => {
      // A 409 means this is the account's only sign-in method — the row must
      // stay, and we surface the server's specific reason rather than a generic
      // failure. Deliberately no invalidate() here.
      if (isConflict(error)) {
        notify(conflictDetail(error) ?? 'Cannot unlink your only sign-in method')
        return
      }
      notifyError(error, 'Could not unlink the SSO account')
    },
  })

  const askUnlink = (identity: LinkedIdentity) => {
    confirmDelete({
      title: 'Unlink SSO account',
      message: `Unlink your ${identity.provider_name} account (${identity.subject})? You will no longer be able to sign in with it.`,
      confirmLabel: 'Unlink account',
      onConfirm: () => unlink.mutate(identity.id),
    })
  }

  return (
    <Stack gap={0}>
      {identities.length === 0 ? (
        <Text c="dimmed" py="sm" size="sm">
          No linked SSO accounts.
        </Text>
      ) : (
        identities.map((identity) => (
          <Group
            key={identity.id}
            data-testid={`identity-row-${identity.id}`}
            justify="space-between"
            wrap="nowrap"
            py="xs"
            style={{ borderBottom: '1px solid var(--line-soft)' }}
          >
            <Stack gap={0} miw={0}>
              <Text fw={600}>{identity.provider_name}</Text>
              <Text size="xs" c="dimmed" ff="monospace">
                {identity.subject}
              </Text>
              <Text size="xs" c="var(--faint)">
                Linked on {compactDate(identity.created_at)}
              </Text>
            </Stack>
            <Button
              size="xs"
              variant="default"
              color="red"
              loading={unlink.isPending && unlink.variables === identity.id}
              onClick={() => askUnlink(identity)}
            >
              Unlink
            </Button>
          </Group>
        ))
      )}
    </Stack>
  )
}

/**
 * Linked external SSO identities for the signed-in account. Renders nothing
 * unless the platform reports SSO is enabled (`/system/capabilities`), so the
 * whole surface — and its `GET /auth/identities` fetch — is absent on the OSS
 * build where SSO is off.
 */
export function LinkedIdentitiesSection() {
  const { data: capabilities } = useQuery(systemCapabilitiesQueryOptions())

  if (capabilities?.sso !== true) return null

  return (
    <Panel title="Linked accounts">
      <Stack gap="sm" px={18} py={16}>
        <Text size="sm" c="dimmed">
          External accounts (single sign-on) you can use to sign in. Unlink any
          you no longer use.
        </Text>
        <IdentitiesList />
      </Stack>
    </Panel>
  )
}
