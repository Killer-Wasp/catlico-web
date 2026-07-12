import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'

type Page<T> = { items: T[]; total: number; skip: number; limit: number }

/** Mirrors the backend UserNotificationPublic model. */
export type UserNotification = {
  id: string
  event_type: string
  title: string
  body: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
}

export async function fetchNotifications(): Promise<UserNotification[]> {
  // First page is plenty for the header bell; the settings surface can paginate.
  const page = await api
    .get('notifications/', { searchParams: { limit: 50 } })
    .json<Page<UserNotification>>()
  return page.items
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`notifications/${id}`, {
    json: { read_at: new Date().toISOString() },
  })
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('notifications/read-all')
}

export const notificationsQueryOptions = () =>
  queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: fetchNotifications,
    // `useNotificationSocket` invalidates this on live activity events, so the
    // bell updates instantly in the common case; this poll is just the
    // fallback for when the socket is down (or briefly reconnecting).
    refetchInterval: 60_000,
  })
