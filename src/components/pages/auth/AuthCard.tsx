import { Center, Group, Image, Paper, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

/**
 * The branded card shell shared by the auth pages (forgot / reset password),
 * matching the LoginPage look: centered Paper with the Catlico logo + wordmark.
 */
export function AuthCard({ children }: { children: ReactNode }) {
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
          {children}
        </Stack>
      </Paper>
    </Center>
  )
}
