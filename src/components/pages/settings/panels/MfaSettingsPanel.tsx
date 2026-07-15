import { Stack, Switch, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'
import {
  mfaSettingsKeys,
  mfaSettingsQueryOptions,
  updateMfaSettings,
} from '#/lib/system/mfaSettings'
import type { MfaSettings } from '#/lib/system/mfaSettings'
import {
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

/**
 * Superadmin-only org-wide MFA policy: two switches over `/admin/mfa/settings`.
 * `enabled` requires members to have MFA; `enforced` makes that requirement
 * mandatory for everyone (only meaningful while `enabled` is on, so the switch
 * is disabled otherwise). Like the per-account MfaSection, the whole surface is
 * hidden unless the platform reports the `mfa` capability — OSS builds render
 * nothing here.
 *
 * Every save is a FULL-REPLACE PUT carrying BOTH fields (see
 * `updateMfaSettings`): each switch builds the payload from the *current*
 * settings plus its own change, so toggling one field never clobbers the other.
 */
export function MfaSettingsPanel() {
  const { data: capabilities } = useQuery(systemCapabilitiesQueryOptions())
  const mfaEnabled = capabilities?.mfa === true
  const queryClient = useQueryClient()

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    ...mfaSettingsQueryOptions(),
    enabled: mfaEnabled,
  })

  const mutation = useMutation({
    mutationFn: updateMfaSettings,
    onSuccess: (result) => {
      // Reflect the server's canonical state (it may normalise the pair).
      queryClient.setQueryData(mfaSettingsKeys.all, result)
      notifySuccess('MFA settings updated')
    },
    onError: (error) => notifyError(error, 'Unable to update MFA settings'),
  })

  // Capability gate: invisible on builds without MFA (OSS default). Placed after
  // every hook so the hook order stays stable.
  if (!mfaEnabled) return null

  if (isPending) return <LoadingPanel label="Loading MFA settings..." />
  if (isError)
    return (
      <ErrorPanel
        label="Couldn't load MFA settings."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    )

  // Always send the FULL pair so the field being left alone is preserved.
  const save = (next: MfaSettings) => mutation.mutate(next)

  return (
    <Panel title="Multi-factor authentication">
      <Stack gap="lg" px={18} py={16}>
        <div>
          <Switch
            label="Require MFA"
            description="Members are prompted to set up multi-factor authentication."
            checked={data.enabled}
            disabled={mutation.isPending}
            onChange={(e) =>
              save({ enabled: e.currentTarget.checked, enforced: data.enforced })
            }
          />
        </div>
        <div>
          <Switch
            label="Enforce for all members"
            description="Block access until members complete MFA setup."
            checked={data.enforced}
            disabled={!data.enabled || mutation.isPending}
            onChange={(e) =>
              save({ enabled: data.enabled, enforced: e.currentTarget.checked })
            }
          />
          {!data.enabled && (
            <Text size="xs" c="dimmed" mt={4}>
              Turn on "Require MFA" first to enforce it.
            </Text>
          )}
        </div>
      </Stack>
    </Panel>
  )
}
