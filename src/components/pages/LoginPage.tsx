import {
  Alert,
  Anchor,
  Button,
  Divider,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { isHTTPError } from 'ky'
import { useQuery } from '@tanstack/react-query'
import {
  PasskeyCancelledError,
  login,
  verifyMfaCode,
  verifyPasskey,
} from '#/lib/auth/session'
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
  const [step, setStep] = useState<'password' | 'mfa'>('password')
  const [pendingToken, setPendingToken] = useState('')
  const [code, setCode] = useState('')

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
      if (result.status === 'mfa_required') {
        // No session yet — collect the second factor. NOTE: do not navigate.
        setPendingToken(result.pendingToken)
        setCode('')
        setStep('mfa')
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

  function backToPassword() {
    setStep('password')
    setPendingToken('')
    setCode('')
    setError(null)
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
