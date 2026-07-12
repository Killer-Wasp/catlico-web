import { openSearchPalette } from '#/components/Search/SearchPalette'
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  notificationsQueryOptions,
} from '#/components/Header/notificationsQueries'
import { useNotificationSocket } from '#/components/Header/useNotificationSocket'
import { UserAvatar } from '#/components/Users/UserAvatar'
import { userDisplayName } from '#/components/Users/usersQueries'
import { logout } from '#/lib/auth/session'
import { currentUserQueryOptions } from '#/lib/auth/userQueries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  Indicator,
  Menu,
  Popover,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { Bell, Building2, LogOut, Moon, Search, Sun, UserCog } from 'lucide-react'
import classes from './Header.module.css'

dayjs.extend(relativeTime)

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
  const queryClient = useQueryClient()
  const { data: notifications = [] } = useQuery(notificationsQueryOptions())
  const unreadCount = notifications.filter((item) => item.read_at === null).length
  const { data: currentUser } = useQuery(currentUserQueryOptions())
  const navigate = useNavigate()

  // Instant bell updates: invalidate the notifications query the moment an
  // activity event lands on the socket, instead of waiting on the 60s poll.
  useNotificationSocket()

  // The "/" shortcut the search box advertises. Mantine's useHotkeys ignores
  // keystrokes typed into inputs, so this only fires from the page at large.
  useHotkeys([['/', openSearchPalette]])

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.all })

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  })
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  })

  // Clear the local session, then hard-navigate so all in-memory state (React
  // Query cache, component state) is dropped and the `_app` guard re-runs.
  const handleLogout = () => {
    logout()
    window.location.assign('/login')
  }

  return (
    <div className={classes.header}>
      <TextInput
        className={classes.search}
        placeholder="Search cases, alerts, observables, tasks, comments…"
        leftSection={<Search size={16} />}
        rightSection={<kbd className={classes.kbd}>/</kbd>}
        aria-label="Search"
        readOnly
        role="button"
        style={{ cursor: 'pointer' }}
        onClick={openSearchPalette}
        onFocus={(e) => {
          // The box is a launcher, not a field: open the palette and drop
          // focus so tabbing back here can re-open it.
          e.currentTarget.blur()
          openSearchPalette()
        }}
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
                  disabled={unreadCount === 0}
                  loading={markAll.isPending}
                  onClick={() => markAll.mutate()}
                >
                  Mark all read
                </Button>
              </Group>
              <Divider />
              <Stack gap={0}>
                {notifications.length === 0 && (
                  <Text px="md" py="lg" c="dimmed" ta="center">
                    No notifications
                  </Text>
                )}
                {notifications.map((item) => {
                  const unread = item.read_at === null
                  return (
                    <UnstyledButton
                      key={item.id}
                      className={classes.notificationItem}
                      onClick={() => {
                        if (unread) markRead.mutate(item.id)
                      }}
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
                        bg={unread ? 'blue.7' : 'transparent'}
                        style={{ borderRadius: 99, flexShrink: 0 }}
                      />
                      <Box flex={1} miw={0}>
                        <Text
                          component="span"
                          fw={unread ? 700 : 600}
                          c={unread ? undefined : 'dimmed'}
                        >
                          {item.title}
                        </Text>
                        {item.body && (
                          <Text component="span" c="dimmed" ml={3}>
                            {item.body}
                          </Text>
                        )}
                      </Box>
                      <Text ff="monospace" fz={11} c="dimmed">
                        {dayjs(item.created_at).fromNow()}
                      </Text>
                    </UnstyledButton>
                  )
                })}
              </Stack>
              <Text px="md" py="sm" ff="monospace" fz={11} c="dimmed">
                Notification rules can be changed in Settings → Notifications
              </Text>
            </Box>
          </Popover.Dropdown>
        </Popover>

        <ThemeToggle />

        <Menu width={200} position="bottom-end" offset={10} shadow="xl">
          <Menu.Target>
            <UnstyledButton
              aria-label="Open account menu"
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            >
              {currentUser ? (
                <UserAvatar user={currentUser} size={34} />
              ) : (
                <Avatar radius="xl" size={34} color="orange" variant="filled" />
              )}
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              {currentUser ? userDisplayName(currentUser) : 'Account'}
            </Menu.Label>
            {currentUser && (
              <Text px="sm" pb={6} fz={11} c="dimmed">
                {currentUser.email}
              </Text>
            )}
            <Menu.Divider />
            {currentUser?.is_superadmin && (
              <Menu.Item
                leftSection={<Building2 size={16} />}
                onClick={() => navigate({ to: '/organisations' })}
              >
                Organisations
              </Menu.Item>
            )}
            <Menu.Item
              leftSection={<UserCog size={16} />}
              onClick={() =>
                navigate({
                  to: '/settings/$section',
                  params: { section: 'my-account' },
                })
              }
            >
              Account settings
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<LogOut size={16} />}
              onClick={handleLogout}
            >
              Log out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  )
}
