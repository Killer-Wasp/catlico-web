import {
  Alert,
  Anchor,
  Button,
  Code,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { isHTTPError } from 'ky'
import { useQuery } from '@tanstack/react-query'
import {
  PasskeyCancelledError,
  confirmMfaEnrollment,
  login,
  mfaPendingKind,
  startMfaEnrollment,
  verifyMfaCode,
  verifyPasskey,
} from '#/lib/auth/session'
import type { MfaEnrollment } from '#/lib/auth/session'
import {
  authProvidersQueryOptions,
  authorizeUrl,
} from '#/lib/auth/authProviders'
import { AuthCard } from './auth/AuthCard'

export function LoginPage({ returnUrl = '/' }: { returnUrl?: string }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Two-step MFA: after a password login the API may demand a second factor,
  // handing back a short-lived pending token instead of a session. We flip to
  // the 'mfa' step and drive the TOTP/recovery-code or passkey endpoints with
  // that token; on success we finish exactly like a normal login (navigate).
  const [step, setStep] = useState<'password' | 'mfa' | 'enroll'>('password')
  const [pendingToken, setPendingToken] = useState('')
  const [code, setCode] = useState('')

  // Forced-enrollment MFA: when org-wide enforcement is on and the account has
  // no second factor, the API hands back an `mfa_enrollment` pending token and
  // we make the user set up TOTP before login completes. The secret + the
  // one-time recovery codes live in transient component state only (never
  // storage) and are cleared once the user acknowledges them.
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)

  // Enterprise SSO providers, fetched pre-auth. In OSS (or on any fetch
  // failure) this stays empty and the SSO section renders nothing — the login
  // page looks exactly as it does without SSO configured. This is purely
  // additive; it must never block the password form.
  const { data: ssoProviders = [] } = useQuery(authProvidersQueryOptions())

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const result = await login(email, password)
      if (result.status === 'password_reset_required') {
        // The account is flagged for a forced reset: no session was issued. Bounce
        // to the standalone reset page (no auth needed) with the single-use token.
        await navigate({
          href: `/reset-password?token=${encodeURIComponent(result.resetToken)}`,
        })
        return
      }
      if (result.status === 'mfa_required') {
        // No session yet — collect the second factor. NOTE: do not navigate.
        // Decode the pending token's type to route: a forced-enrollment token
        // sends us to set up a second factor; anything else is the ordinary
        // verify step (the client-side decode is a hint, so an unknown/malformed
        // type falls back to verify).
        setPendingToken(result.pendingToken)
        setCode('')
        if (mfaPendingKind(result.pendingToken) === 'mfa_enrollment') {
          const data = await startMfaEnrollment(result.pendingToken)
          setEnrollment(data)
          setStep('enroll')
        } else {
          setStep('mfa')
        }
        return
      }
      await navigate({ href: returnUrl })
    } catch (err) {
      setError(
        isHTTPError(err) && err.response.status === 401
          ? 'Incorrect email or password.'
          : err instanceof Error
            ? err.message
            : 'Sign-in failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    setLoading(true)
    setError(null)
    try {
      await verifyMfaCode(pendingToken, code.trim())
      await navigate({ href: returnUrl })
    } catch (err) {
      // Generic messaging (no oracle): a wrong code, a locked factor, and an
      // expired pending token all come back as 401. If it keeps failing the
      // user can go Back and re-enter their password for a fresh token.
      setError(
        isHTTPError(err) && err.response.status === 401
          ? 'Invalid code. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Verification failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handlePasskey() {
    setLoading(true)
    setError(null)
    try {
      await verifyPasskey(pendingToken)
      await navigate({ href: returnUrl })
    } catch (err) {
      if (err instanceof PasskeyCancelledError) {
        setError('Passkey sign-in was cancelled. Enter a code, or try again.')
      } else {
        setError(
          isHTTPError(err) && err.response.status === 401
            ? 'Passkey verification failed. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Passkey sign-in failed. Please try again.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmEnrollment() {
    setLoading(true)
    setError(null)
    try {
      const { recoveryCodes: codes } = await confirmMfaEnrollment(
        pendingToken,
        code.trim(),
      )
      // Session is now established (confirmMfaEnrollment completed it); hold on
      // the recovery-codes view until the user acknowledges before navigating.
      setRecoveryCodes(codes)
      setCode('')
    } catch (err) {
      // A wrong TOTP code comes back as 400; keep the user on the enrollment
      // step to retry (no session was established).
      setError(
        isHTTPError(err) && err.response.status === 400
          ? 'Invalid code. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Verification failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function acknowledgeRecoveryCodes() {
    // Clear the one-time secret + codes from memory, then enter the app — the
    // session was already completed at confirm time.
    setRecoveryCodes(null)
    setEnrollment(null)
    setPendingToken('')
    await navigate({ href: returnUrl })
  }

  const copyRecoveryCodes = () => {
    void navigator.clipboard.writeText((recoveryCodes ?? []).join('\n'))
  }

  const downloadRecoveryCodes = () => {
    try {
      const blob = new Blob([`${(recoveryCodes ?? []).join('\n')}\n`], {
        type: 'text/plain',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'catlico-recovery-codes.txt'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      // Best-effort; the user can still copy or transcribe the codes on screen.
    }
  }

  function backToPassword() {
    setStep('password')
    setPendingToken('')
    setCode('')
    setEnrollment(null)
    setRecoveryCodes(null)
    setError(null)
  }

  if (step === 'enroll') {
    // Recovery-codes-once view: shown after a successful confirm. The session is
    // already established; the user must acknowledge before entering the app.
    if (recoveryCodes) {
      return (
        <AuthCard>
          <Stack gap="md" data-testid="recovery-codes">
            <Text fw={700} fz={18}>
              Save your recovery codes
            </Text>
            <Text size="sm" c="dimmed">
              Each code works once if you lose your authenticator. They are shown
              only this once — store them somewhere safe.
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
              {recoveryCodes.map((recoveryCode) => (
                <Code key={recoveryCode} data-testid="recovery-code" fz="sm">
                  {recoveryCode}
                </Code>
              ))}
            </SimpleGrid>
            <Group>
              <Button variant="default" onClick={copyRecoveryCodes}>
                Copy all
              </Button>
              <Button variant="default" onClick={downloadRecoveryCodes}>
                Download .txt
              </Button>
            </Group>
            <Button
              color="orange.6"
              size="lg"
              radius="md"
              fullWidth
              loading={loading}
              onClick={() => void acknowledgeRecoveryCodes()}
              styles={{
                root: { height: 58 },
                label: { fontSize: 17, fontWeight: 700 },
              }}
            >
              I&apos;ve saved these — continue
            </Button>
          </Stack>
        </AuthCard>
      )
    }

    // Enrollment view: show the secret + otpauth link for manual entry, then
    // take a 6-digit code to confirm.
    return (
      <AuthCard>
        <Stack
          component="form"
          gap="md"
          onSubmit={(e) => {
            e.preventDefault()
            void handleConfirmEnrollment()
          }}
        >
          {error && (
            <Alert color="red" variant="light" radius="md" py="xs">
              {error}
            </Alert>
          )}
          <Text fw={700} fz={18}>
            Set up two-factor authentication
          </Text>
          <Text size="sm" c="dimmed">
            Your organization requires a second factor. Add this account to your
            authenticator app using the secret below (or the setup link), then
            enter the 6-digit code it shows.
          </Text>
          {enrollment && (
            <>
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Secret (manual entry)
                </Text>
                <Code data-testid="enroll-secret" fz="md">
                  {enrollment.secret}
                </Code>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb={4}>
                  Setup link (otpauth)
                </Text>
                <Text
                  data-testid="enroll-uri"
                  size="xs"
                  ff="monospace"
                  style={{ wordBreak: 'break-all' }}
                >
                  {enrollment.provisioning_uri}
                </Text>
              </div>
            </>
          )}
          <TextInput
            label="Verification code"
            placeholder="123456"
            description="Enter the 6-digit code from your authenticator app."
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            autoFocus
            autoComplete="one-time-code"
            required
            disabled={loading}
            withAsterisk={false}
            size="lg"
            radius="md"
            styles={{
              input: {
                backgroundColor: '#eef2f7',
                borderColor: '#dce2ea',
                fontSize: 18,
                height: 56,
              },
              label: {
                color: '#5f6877',
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 8,
              },
            }}
          />

          <Button
            type="submit"
            color="orange.6"
            size="lg"
            radius="md"
            fullWidth
            mt={4}
            loading={loading}
            disabled={code.trim().length === 0}
            styles={{
              root: {
                height: 58,
                boxShadow: '0 14px 24px rgba(234, 88, 12, 0.25)',
              },
              label: { fontSize: 17, fontWeight: 700 },
            }}
          >
            Verify and enable
          </Button>

          <Anchor
            component="button"
            type="button"
            onClick={backToPassword}
            c="gray.7"
            fw={600}
            ta="center"
            underline="never"
            data-disabled={loading || undefined}
            style={loading ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          >
            Back
          </Anchor>
        </Stack>
      </AuthCard>
    )
  }

  if (step === 'mfa') {
    return (
      <AuthCard>
        <Stack
          component="form"
          gap="md"
          onSubmit={(e) => {
            e.preventDefault()
            void handleVerifyCode()
          }}
        >
          {error && (
            <Alert color="red" variant="light" radius="md" py="xs">
              {error}
            </Alert>
          )}
          <TextInput
            label="Authentication code"
            placeholder="123456"
            description="Enter the 6-digit code from your authenticator app, or a recovery code."
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            autoFocus
            autoComplete="one-time-code"
            required
            disabled={loading}
            withAsterisk={false}
            size="lg"
            radius="md"
            styles={{
              input: {
                backgroundColor: '#eef2f7',
                borderColor: '#dce2ea',
                fontSize: 18,
                height: 56,
              },
              label: {
                color: '#5f6877',
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 8,
              },
            }}
          />

          <Button
            type="submit"
            color="orange.6"
            size="lg"
            radius="md"
            fullWidth
            mt={4}
            loading={loading}
            styles={{
              root: {
                height: 58,
                boxShadow: '0 14px 24px rgba(234, 88, 12, 0.25)',
              },
              label: { fontSize: 17, fontWeight: 700 },
            }}
          >
            Verify
          </Button>

          <Divider label="or" labelPosition="center" c="gray.6" />

          <Button
            variant="default"
            size="lg"
            radius="md"
            fullWidth
            disabled={loading}
            onClick={() => void handlePasskey()}
            styles={{
              root: { height: 58 },
              label: { fontSize: 16, fontWeight: 600 },
            }}
          >
            Use a passkey
          </Button>

          <Anchor
            component="button"
            type="button"
            onClick={backToPassword}
            c="gray.7"
            fw={600}
            ta="center"
            underline="never"
            data-disabled={loading || undefined}
            style={loading ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          >
            Back
          </Anchor>
        </Stack>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      {ssoProviders.length > 0 && (
        <Stack gap="sm">
          {ssoProviders.map((provider) => (
            <Button
              key={provider.id}
              variant="default"
              size="lg"
              radius="md"
              fullWidth
              // Start SSO with a FULL-PAGE navigation to the API's authorize
              // endpoint so the IdP redirect + state cookie round-trip works —
              // not a router navigate or fetch.
              onClick={() =>
                window.location.assign(authorizeUrl(provider.authorize_path))
              }
              styles={{
                root: { height: 58 },
                label: { fontSize: 16, fontWeight: 600 },
              }}
            >
              Continue with {provider.name}
            </Button>
          ))}
          <Divider label="or" labelPosition="center" c="gray.6" />
        </Stack>
      )}
      <Stack
        component="form"
        gap="md"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        {error && (
          <Alert color="red" variant="light" radius="md" py="xs">
            {error}
          </Alert>
        )}
        <TextInput
          label="Email"
          type="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          withAsterisk={false}
          size="lg"
          radius="md"
          styles={{
            input: {
              backgroundColor: '#eef2f7',
              borderColor: '#dce2ea',
              fontSize: 18,
              height: 56,
            },
            label: {
              color: '#5f6877',
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 8,
            },
          }}
        />

        <PasswordInput
          label="Password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
          withAsterisk={false}
          size="lg"
          radius="md"
          styles={{
            input: {
              backgroundColor: '#eef2f7',
              borderColor: '#dce2ea',
              fontSize: 18,
              height: 56,
            },
            innerInput: {
              height: 54,
            },
            label: {
              color: '#5f6877',
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 8,
            },
          }}
        />

        <Button
          type="submit"
          color="orange.6"
          size="lg"
          radius="md"
          fullWidth
          mt={4}
          loading={loading}
          styles={{
            root: {
              height: 58,
              boxShadow: '0 14px 24px rgba(234, 88, 12, 0.25)',
            },
            label: { fontSize: 17, fontWeight: 700 },
          }}
        >
          Sign in
        </Button>

        <Anchor
          component={Link}
          to="/forgot-password"
          c="gray.7"
          fw={600}
          ta="center"
          underline="never"
        >
          Forgot password?
        </Anchor>
      </Stack>
    </AuthCard>
  )
}
