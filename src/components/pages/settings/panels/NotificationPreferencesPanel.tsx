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

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient()
  const {
    data: items,
    isPending,
    isError,
  } = useQuery(notificationPreferencesQueryOptions())

  // The set of event_types whose toggle is currently mid-flight, so each switch
  // disables independently while ITS OWN write is in progress. A scalar would
  // mishandle concurrent toggles (switch B's mutation would re-enable switch A
  // and its settle would clear A's pending flag out of order).
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const addPending = (eventType: string) =>
    setPending((prev) => new Set(prev).add(eventType))
  const removePending = (eventType: string) =>
    setPending((prev) => {
      const next = new Set(prev)
      next.delete(eventType)
      return next
    })

  const mutation = useMutation({
    mutationFn: ({
      eventType,
      enabled,
    }: {
      eventType: string
      enabled: boolean
    }) => updateNotificationPreferences({ [eventType]: enabled }),
    onMutate: ({ eventType }) => addPending(eventType),
    onSuccess: (data) => {
      // The PUT returns the fresh catalog, so seed it directly rather than
      // refetching. Invalidating `notificationKeys.all` would refetch the
      // preferences query too (`all` prefixes `preferences()`) and undo this.
      queryClient.setQueryData(notificationKeys.preferences(), data)
      // The bell feed's server-side filtering changed, so refresh just it.
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() })
    },
    onError: () =>
      notifications.show({
        color: 'red',
        message: 'Failed to update notification preferences',
      }),
    onSettled: (_data, _error, { eventType }) => removePending(eventType),
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
                      disabled={pending.has(item.event_type)}
                      onChange={(event) =>
                        mutation.mutate({
                          eventType: item.event_type,
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
