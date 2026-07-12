import { Box, LoadingOverlay, Stack, Switch, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  notificationKeys,
  notificationPreferencesQueryOptions,
  updateNotificationPreferences,
} from '#/components/Header/notificationsQueries'
import type { NotificationPreferenceItem } from '#/components/Header/notificationsQueries'
import { Panel } from '#/components/pages/settings/settingsUi'

// Group the flat catalog by its `category` field, preserving first-seen order so
// the UI layout is driven by the API, not a hardcoded category list.
function groupByCategory(items: NotificationPreferenceItem[]) {
  const groups: { category: string; items: NotificationPreferenceItem[] }[] = []
  const byCategory = new Map<string, NotificationPreferenceItem[]>()
  for (const item of items) {
    let bucket = byCategory.get(item.category)
    if (!bucket) {
      bucket = []
      byCategory.set(item.category, bucket)
      groups.push({ category: item.category, items: bucket })
    }
    bucket.push(item)
  }
  return groups
}

export function NotificationPreferences() {
  const queryClient = useQueryClient()
  const {
    data: items,
    isPending,
    isError,
  } = useQuery(notificationPreferencesQueryOptions())

  // The event_type whose toggle is mid-flight, so we can disable just that
  // switch while its write is in progress (rapid toggles don't race visually).
  const [pendingType, setPendingType] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({
      event_type,
      enabled,
    }: {
      event_type: string
      enabled: boolean
    }) => updateNotificationPreferences({ [event_type]: enabled }),
    onMutate: ({ event_type }) => setPendingType(event_type),
    onSuccess: () => {
      // Refresh this panel and the bell feed (its server-side filtering changed).
      queryClient.invalidateQueries({
        queryKey: notificationKeys.preferences(),
      })
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: () =>
      notifications.show({
        color: 'red',
        message: 'Failed to update notification preferences',
      }),
    onSettled: () => setPendingType(null),
  })

  const groups = items ? groupByCategory(items) : []

  return (
    <Panel title="Notification preferences">
      <Box p={18}>
        <Text fz={13} c="var(--muted)" mb="md">
          Choose which activity sends you in-app notifications.
        </Text>

        <Box pos="relative" mih={items && items.length ? undefined : 60}>
          <LoadingOverlay visible={isPending} />

          {isError && (
            <Text c="red.7" fz={13}>
              Couldn&apos;t load your notification preferences.
            </Text>
          )}

          {!isError && items && items.length === 0 && (
            <Text c="dimmed" fz={13}>
              No notification types are available.
            </Text>
          )}

          <Stack gap="lg">
            {groups.map((group) => (
              <div key={group.category}>
                <Text fw={600} fz={13} mb="xs">
                  {group.category}
                </Text>
                <Stack gap="xs">
                  {group.items.map((item) => (
                    <Switch
                      key={item.event_type}
                      label={item.label}
                      checked={item.enabled}
                      disabled={
                        mutation.isPending && pendingType === item.event_type
                      }
                      onChange={(event) =>
                        mutation.mutate({
                          event_type: item.event_type,
                          enabled: event.currentTarget.checked,
                        })
                      }
                    />
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        </Box>
      </Box>
    </Panel>
  )
}
