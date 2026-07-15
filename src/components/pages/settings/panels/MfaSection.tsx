import { useState } from 'react'
import {
  Badge,
  Button,
  Code,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'
import {
  confirmTotp,
  deletePasskey,
  disableTotp,
  enrollTotp,
  mfaKeys,
  passkeysQueryOptions,
  registerPasskey,
} from '#/lib/auth/mfa'
import type { PasskeyPublic, TotpEnrollResult } from '#/lib/auth/mfa'
import { PasskeyCancelledError } from '#/lib/auth/session'
import {
  compactDate,
  confirmDelete,
  copyToClipboard,
  notify,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

/**
 * There is no dedicated "MFA status" endpoint, so TOTP state is a small local
 * machine driven by the enroll → confirm ceremony: `idle` (offer setup),
 * `enrolling` (show the secret + take a code), `recovery` (show the one-time
 * codes), `enabled` (offer disable). A 409 on enroll short-circuits straight to
 * `enabled` — it means TOTP was already confirmed on this account.
 */
type TotpState =
  | { kind: 'idle' }
  | { kind: 'enrolling'; enroll: TotpEnrollResult }
  | { kind: 'recovery'; codes: string[] }
  | { kind: 'enabled' }

/** True for a ky HTTPError (or a test double) carrying a 409 status. */
function isConflict(error: unknown): boolean {
  const withResponse = error as { response?: { status?: number } }
  return withResponse.response?.status === 409
}

// QR note: we render the `secret` for manual entry plus the raw otpauth:// URI
// rather than a QR image. A QR would be nicer, but the repo's lockfile currently
// can't resolve a new dependency (an unrelated `@tanstack/*: latest` pin fails
// to install), so adding a `qrcode` lib here isn't clean. Manual entry keeps the
// flow dependency-free and fully testable; swap in a QR data-URL once the
// lockfile is unblocked.

function TotpSection() {
  const [totp, setTotp] = useState<TotpState>({ kind: 'idle' })
  const [code, setCode] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  const enroll = useMutation({
    mutationFn: enrollTotp,
    onSuccess: (data) => setTotp({ kind: 'enrolling', enroll: data }),
    onError: (error) => {
      if (isConflict(error)) {
        setTotp({ kind: 'enabled' })
        notify('Authenticator app is already set up on this account.')
        return
      }
      notifyError(error, 'Could not start authenticator setup')
    },
  })

  const confirm = useMutation({
    mutationFn: (value: string) => confirmTotp(value),
    onSuccess: (data) => {
      setTotp({ kind: 'recovery', codes: data.recovery_codes })
      setCode('')
    },
    onError: (error) => notifyError(error, 'That code was not valid'),
  })

  const disable = useMutation({
    mutationFn: (input: { password: string; code: string }) =>
      disableTotp(input.password, input.code),
    onSuccess: () => {
      setTotp({ kind: 'idle' })
      setShowDisable(false)
      setDisablePassword('')
      setDisableCode('')
      notifySuccess('Authenticator app disabled')
    },
    onError: (error) =>
      notifyError(error, 'Could not disable the authenticator app'),
  })

  const copyAll = async (codes: string[]) => {
    if (await copyToClipboard(codes.join('\n')))
      notifySuccess('Recovery codes copied')
    else notify('Copy failed — select the codes and copy them manually.')
  }

  const downloadCodes = (codes: string[]) => {
    try {
      const blob = new Blob([`${codes.join('\n')}\n`], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'catlico-recovery-codes.txt'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      notify('Could not download the file — copy the codes instead.')
    }
  }

  return (
    <Stack gap="sm">
      <Title order={3} fz={14}>
        Authenticator app
      </Title>
      <Text size="sm" c="dimmed">
        Use a TOTP app (Google Authenticator, 1Password, Authy) for a second
        factor at sign-in.
      </Text>

      {totp.kind === 'idle' && (
        <Group>
          <Button
            onClick={() => enroll.mutate()}
            loading={enroll.isPending}
            style={{ alignSelf: 'flex-start' }}
          >
            Set up authenticator app
          </Button>
        </Group>
      )}

      {totp.kind === 'enrolling' && (
        <Stack gap="sm">
          <Text size="sm">
            Add this account to your authenticator app by entering the secret
            below (or opening the setup link), then enter the 6-digit code it
            shows.
          </Text>
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Secret (manual entry)
            </Text>
            <Code data-testid="totp-secret" fz="md">
              {totp.enroll.secret}
            </Code>
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Setup link (otpauth)
            </Text>
            <Text
              data-testid="totp-uri"
              size="xs"
              ff="monospace"
              style={{ wordBreak: 'break-all' }}
            >
              {totp.enroll.provisioning_uri}
            </Text>
          </div>
          <TextInput
            label="Verification code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value)}
            maw={220}
          />
          <Group>
            <Button
              onClick={() => confirm.mutate(code)}
              loading={confirm.isPending}
              disabled={code.trim().length === 0}
            >
              Verify and enable
            </Button>
            <Button variant="subtle" onClick={() => setTotp({ kind: 'idle' })}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      {totp.kind === 'recovery' && (
        <Stack gap="sm" data-testid="recovery-codes">
          <Text fw={600}>Save your recovery codes</Text>
          <Text size="sm" c="dimmed">
            Each code works once if you lose your authenticator. They are shown
            only this once — store them somewhere safe.
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
            {totp.codes.map((recoveryCode) => (
              <Code key={recoveryCode} data-testid="recovery-code" fz="sm">
                {recoveryCode}
              </Code>
            ))}
          </SimpleGrid>
          <Group>
            <Button variant="default" onClick={() => copyAll(totp.codes)}>
              Copy all
            </Button>
            <Button variant="default" onClick={() => downloadCodes(totp.codes)}>
              Download .txt
            </Button>
          </Group>
          <Button
            onClick={() => setTotp({ kind: 'enabled' })}
            style={{ alignSelf: 'flex-start' }}
          >
            I&apos;ve saved these
          </Button>
        </Stack>
      )}

      {totp.kind === 'enabled' && (
        <Stack gap="sm">
          <Group>
            <Badge color="green" variant="light" radius="sm">
              Authenticator app enabled
            </Badge>
            {!showDisable && (
              <Button
                variant="default"
                color="red"
                onClick={() => setShowDisable(true)}
              >
                Disable
              </Button>
            )}
          </Group>
          {showDisable && (
            <Stack gap="xs" maw={320}>
              <Text size="sm" c="dimmed">
                Confirm with your password and a current code to turn off the
                authenticator app.
              </Text>
              <PasswordInput
                label="Password"
                value={disablePassword}
                onChange={(event) =>
                  setDisablePassword(event.currentTarget.value)
                }
              />
              <TextInput
                label="Current code"
                placeholder="123456"
                value={disableCode}
                onChange={(event) => setDisableCode(event.currentTarget.value)}
              />
              <Group>
                <Button
                  color="red"
                  loading={disable.isPending}
                  disabled={
                    disablePassword.length === 0 || disableCode.trim().length === 0
                  }
                  onClick={() =>
                    disable.mutate({
                      password: disablePassword,
                      code: disableCode,
                    })
                  }
                >
                  Disable authenticator app
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setShowDisable(false)
                    setDisablePassword('')
                    setDisableCode('')
                  }}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  )
}

function PasskeysSection() {
  const queryClient = useQueryClient()
  const [passkeyName, setPasskeyName] = useState('')
  const { data: passkeys = [] } = useQuery(passkeysQueryOptions())

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: mfaKeys.passkeys() })

  const register = useMutation({
    mutationFn: (name: string) => registerPasskey(name),
    onSuccess: () => {
      setPasskeyName('')
      invalidate()
      notifySuccess('Passkey added')
    },
    onError: (error) => {
      // A dismissed prompt is a normal user choice, not an error — mirror the
      // login-side handling and stay quiet-ish (a soft notice, no red toast).
      if (error instanceof PasskeyCancelledError) {
        notify(error.message)
        return
      }
      notifyError(error, 'Could not add the passkey')
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePasskey(id),
    onSuccess: () => {
      invalidate()
      notifySuccess('Passkey removed')
    },
    onError: (error) => notifyError(error, 'Could not remove the passkey'),
  })

  const askRemove = (passkey: PasskeyPublic) => {
    const label = passkey.name || 'this passkey'
    confirmDelete({
      title: 'Remove passkey',
      message: `Remove ${label}? That device will no longer be usable as a second factor.`,
      confirmLabel: 'Remove passkey',
      onConfirm: () => remove.mutate(passkey.id),
    })
  }

  return (
    <Stack gap="sm">
      <Title order={3} fz={14}>
        Passkeys
      </Title>
      <Text size="sm" c="dimmed">
        Passkeys let you sign in with your device&apos;s biometrics or a security
        key.
      </Text>

      <Group align="flex-end">
        <TextInput
          label="Passkey name (optional)"
          placeholder="e.g. Work laptop"
          value={passkeyName}
          onChange={(event) => setPasskeyName(event.currentTarget.value)}
          maw={240}
        />
        <Button
          onClick={() => register.mutate(passkeyName)}
          loading={register.isPending}
        >
          Add a passkey
        </Button>
      </Group>

      <Stack gap={0}>
        {passkeys.length === 0 ? (
          <Text c="dimmed" py="sm" size="sm">
            No passkeys yet.
          </Text>
        ) : (
          passkeys.map((passkey) => (
            <Group
              key={passkey.id}
              data-testid={`passkey-row-${passkey.id}`}
              justify="space-between"
              wrap="nowrap"
              py="xs"
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Stack gap={0} miw={0}>
                <Text fw={600}>{passkey.name || 'Unnamed passkey'}</Text>
                <Text size="xs" c="dimmed">
                  Added {compactDate(passkey.created_at)}
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="default"
                color="red"
                loading={remove.isPending && remove.variables === passkey.id}
                onClick={() => askRemove(passkey)}
              >
                Delete
              </Button>
            </Group>
          ))
        )}
      </Stack>
    </Stack>
  )
}

/**
 * Multi-factor-auth management (TOTP + passkeys) for the signed-in account.
 * Renders nothing unless the platform reports MFA is enabled
 * (`/system/capabilities`), so the whole surface is invisible on builds where an
 * admin hasn't turned MFA on.
 */
export function MfaSection() {
  const { data: capabilities } = useQuery(systemCapabilitiesQueryOptions())

  if (capabilities?.mfa !== true) return null

  return (
    <Panel title="Multi-factor authentication">
      <Stack gap="lg" px={18} py={16}>
        <TotpSection />
        <Divider />
        <PasskeysSection />
      </Stack>
    </Panel>
  )
}
