import { Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { requestPasswordReset } from '#/lib/auth/session'
import { AuthCard } from './auth/AuthCard'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      // The API never reveals whether the email exists, so success here means
      // "request accepted", not "account found".
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <AuthCard>
        <Stack gap="md">
          <Text fw={700} fz="lg">
            Check your email
          </Text>
          <Text c="gray.7">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a
            link to reset your password. The link expires in one hour.
          </Text>
          <Anchor component={Link} to="/login" c="orange.7" fw={600}>
            Back to sign in
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
        <Text c="gray.7">
          Enter your email and we&apos;ll send you a link to reset your password.
        </Text>
        {error && (
          <Alert color="red" variant="light" radius="md" py="xs">
            {error}
          </Alert>
        )}
        <TextInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
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
        >
          Send reset link
        </Button>
        <Anchor component={Link} to="/login" c="gray.7" fw={600} ta="center">
          Back to sign in
        </Anchor>
      </Stack>
    </AuthCard>
  )
}
