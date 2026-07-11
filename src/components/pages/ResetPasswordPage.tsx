import { Alert, Anchor, Button, PasswordInput, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { isHTTPError } from 'ky'
import { useState } from 'react'
import { MIN_PASSWORD_LENGTH, passwordMeetsPolicy } from '#/lib/auth/passwordPolicy'
import { resetPassword } from '#/lib/auth/session'
import { AuthCard } from './auth/AuthCard'

export function ResetPasswordPage({ token }: { token?: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const tooShort = password.length > 0 && !passwordMeetsPolicy(password)
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = passwordMeetsPolicy(password) && password === confirm

  async function handleSubmit() {
    if (!token || !canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (isHTTPError(err) && err.response.status === 400) {
        // Surface the server's reason (expired link vs. policy rejection)
        // instead of assuming which 400 this was.
        const detail = await err.response
          .clone()
          .json()
          .then((body: unknown) =>
            typeof body === 'object' &&
            body !== null &&
            'detail' in body &&
            typeof body.detail === 'string'
              ? body.detail
              : null,
          )
          .catch(() => null)
        setError(
          detail ?? 'This reset link is invalid or has expired. Request a new one.',
        )
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <Stack gap="md">
          <Text fw={700} fz="lg">
            Invalid reset link
          </Text>
          <Text c="gray.7">
            This link is missing its reset token. Request a new one to continue.
          </Text>
          <Anchor component={Link} to="/forgot-password" c="orange.7" fw={600}>
            Request a new link
          </Anchor>
        </Stack>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard>
        <Stack gap="md">
          <Text fw={700} fz="lg">
            Password updated
          </Text>
          <Text c="gray.7">
            Your password has been reset. You can now sign in with your new
            password.
          </Text>
          <Anchor component={Link} to="/login" c="orange.7" fw={600}>
            Sign in
          </Anchor>
        </Stack>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <Stack
        component="form"
        gap="md"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <Text c="gray.7">Choose a new password for your account.</Text>
        {error && (
          <Alert color="red" variant="light" radius="md" py="xs">
            {error}
          </Alert>
        )}
        <PasswordInput
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters` : null}
          required
          withAsterisk={false}
          size="lg"
          radius="md"
        />
        <PasswordInput
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.currentTarget.value)}
          error={mismatch ? 'Passwords do not match' : null}
          required
          withAsterisk={false}
          size="lg"
          radius="md"
        />
        <Button
          type="submit"
          color="orange.6"
          size="lg"
          radius="md"
          fullWidth
          loading={loading}
          disabled={!canSubmit}
        >
          Reset password
        </Button>
        <Anchor component={Link} to="/login" c="gray.7" fw={600} ta="center">
          Back to sign in
        </Anchor>
      </Stack>
    </AuthCard>
  )
}
