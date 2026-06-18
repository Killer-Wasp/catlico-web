import {
  Alert,
  Anchor,
  Button,
  Center,
  Divider,
  Group,
  Image,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { Grid2X2 } from 'lucide-react'
import { useState } from 'react'
import { isHTTPError } from 'ky'
import { login } from '#/lib/auth/session'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      await navigate({ to: '/' })
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
    <Center bg="gray.0" mih="100vh" p="xl">
      <Paper
        component="main"
        radius={16}
        shadow="0 24px 70px rgba(15, 23, 42, 0.10)"
        p={40}
        w="100%"
        maw={420}
        withBorder
        style={{ borderColor: 'rgba(226, 232, 240, 0.8)' }}
      >
        <Stack gap={24}>
          <Group justify="center" gap={12}>
            <Image
              src="/catlico-logo.png"
              alt="Catlico logo"
              w={52}
              h={52}
              radius="xl"
              style={{
                boxShadow:
                  '0 0 0 1px rgba(226, 232, 240, 0.9), 0 6px 16px rgba(31, 31, 30, 0.12)',
              }}
            />
            <Text
              ff="'Space Grotesk', var(--mantine-font-family)"
              fz={28}
              fw={700}
              lts="0.06em"
              tt="uppercase"
              variant="gradient"
              gradient={{ from: 'orange.6', to: 'dark.9', deg: 105 }}
              style={{ lineHeight: 1 }}
            >
              Catlico
            </Text>
          </Group>

          <Button
            type="button"
            variant="default"
            size="lg"
            radius="md"
            fullWidth
            leftSection={<Grid2X2 size={20} strokeWidth={2.2} />}
            styles={{
              root: {
                height: 56,
                borderColor: '#dce2ea',
                backgroundColor: '#f0f3f8',
              },
              label: { fontSize: 17, fontWeight: 700 },
            }}
          >
            Continue with Entra ID SSO
          </Button>

          <Divider
            label="OR LOCAL ACCOUNT"
            labelPosition="center"
            styles={{
              label: {
                color: '#98a2b3',
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.2,
              },
            }}
          />

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
          </Stack>

          <Group justify="space-between" mt={-4}>
            <Anchor href="#" c="gray.7" fw={600} underline="never">
              Forgot password
            </Anchor>
            <Anchor href="#" c="gray.7" fw={600} underline="never">
              Request access
            </Anchor>
          </Group>
        </Stack>
      </Paper>
    </Center>
  )
}
