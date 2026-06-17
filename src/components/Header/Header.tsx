import { Bell, Moon, Search, Sun } from 'lucide-react'
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  Indicator,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import classes from './Header.module.css'
import { useState } from 'react'

type NotificationItem = {
  title: string
  detail: string
  time: string
  unread: boolean
  critical?: boolean
}

const initialNotifications: NotificationItem[] = [
  {
    title: 'SLA breach imminent',
    detail: 'Case #1842 acknowledges in 28 minutes',
    time: '2m',
    unread: true,
    critical: true,
  },
  {
    title: 'Critical alert ingested',
    detail: 'AL-9123 · ransomware staging on FILESRV-AU02',
    time: '14m',
    unread: true,
    critical: true,
  },
  {
    title: 'Cortex job finished',
    detail: 'VirusTotal on login-originenergy.support — 12/93 hits',
    time: '31m',
    unread: true,
  },
  {
    title: 'You were mentioned',
    detail: 'P. Nguyen in #1842: “@jtanaka audit log pulled, see task 2”',
    time: '48m',
    unread: false,
  },
  {
    title: 'Case assigned to you',
    detail: '#1834 credential phish — retail billing team',
    time: '4h',
    unread: false,
  },
  {
    title: 'MISP sync completed',
    detail: 'Event 4417 updated · 4 attributes pushed',
    time: '5h',
    unread: false,
  },
]

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  })
  const isDark = computed === 'dark'

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="md"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </ActionIcon>
  )
}

export function Header() {
  const [notifications, setNotifications] = useState(initialNotifications)
  const unreadCount = notifications.filter((item) => item.unread).length

  const markRead = (index: number) =>
    setNotifications((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, unread: false } : item,
      ),
    )

  return (
    <div className={classes.header}>
      <TextInput
        className={classes.search}
        placeholder="Search cases, alerts, observables… (e.g. type:ip 203.0.113.*)"
        leftSection={<Search size={16} />}
        rightSection={<kbd className={classes.kbd}>/</kbd>}
        aria-label="Search"
      />

      <div className={classes.actions}>
        <Popover width={380} position="bottom-end" offset={10} shadow="xl">
          <Popover.Target>
            <Indicator
              label={unreadCount || undefined}
              disabled={unreadCount === 0}
              size={16}
              offset={5}
              color="orange"
            >
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </ActionIcon>
            </Indicator>
          </Popover.Target>
          <Popover.Dropdown p={0}>
            <Box role="dialog" aria-label="Notifications">
              <Group px="md" py="sm" justify="space-between" wrap="nowrap">
                <Text component="h2" fz={16} fw={700} m={0}>
                  Notifications
                </Text>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.map((item) => ({ ...item, unread: false })),
                    )
                  }
                >
                  Mark all read
                </Button>
              </Group>
              <Divider />
              <Stack gap={0}>
                {notifications.map((item, index) => (
                  <UnstyledButton
                    key={`${item.title}-${item.time}`}
                    className={classes.notificationItem}
                    onClick={() => markRead(index)}
                    px="md"
                    py="sm"
                    style={(theme) => ({
                      display: 'flex',
                      gap: 11,
                      alignItems: 'flex-start',
                      width: '100%',
                      borderBottom: `1px solid ${theme.colors.gray[2]}`,
                    })}
                  >
                    <Box
                      mt={7}
                      w={8}
                      h={8}
                      bg={
                        item.unread
                          ? item.critical
                            ? 'red.7'
                            : 'blue.7'
                          : 'transparent'
                      }
                      style={{ borderRadius: 99, flexShrink: 0 }}
                    />
                    <Box flex={1} miw={0}>
                      <Text
                        component="span"
                        fw={item.unread ? 700 : 600}
                        c={item.unread ? undefined : 'dimmed'}
                      >
                        {item.title}
                      </Text>
                      <Text component="span" c="dimmed" ml={3}>
                        {item.detail}
                      </Text>
                    </Box>
                    <Text ff="monospace" fz={11} c="dimmed">
                      {item.time}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
              <Text px="md" py="sm" ff="monospace" fz={11} c="dimmed">
                Notification rules can be changed in Settings → Notifications
              </Text>
            </Box>
          </Popover.Dropdown>
        </Popover>

        <ThemeToggle />

        <Avatar radius="md" size={34} color="orange" variant="filled">
          JT
        </Avatar>
      </div>
    </div>
  )
}
