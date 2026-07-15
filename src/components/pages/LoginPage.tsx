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
import { login } from '#/lib/auth/session'
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

  // Enterprise SSO providers, fetched pre-auth. In OSS (or on any fetch
  // failure) this stays empty and the SSO section renders nothing — the login
  // page looks exactly as it does without SSO configured. This is purely
  // additive; it must never block the password form.
  const { data: ssoProviders = [] } = useQuery(authProvidersQueryOptions())

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
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
