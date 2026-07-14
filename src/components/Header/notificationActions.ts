import { notificationRoute } from '#/lib/notificationRoute'
import type { NotificationRoute } from '#/lib/notificationRoute'
import type { UserNotification } from '#/components/Header/notificationsQueries'

/** Side effects a notification-row click can trigger. Injected so the behaviour
 * is unit-testable without the Mantine popover / router in the loop. */
export type NotificationActions = {
  markRead: (id: string) => void
  navigate: (target: NotificationRoute) => void
  close: () => void
}

/**
 * What happens when a notification row is clicked:
 *   - mark it read (only if currently unread), and
 *   - if its payload deep-links somewhere, close the dropdown and navigate.
 *
 * An unmappable payload is a mark-read only — no navigation, dropdown stays put.
 */
export function activateNotification(
  item: UserNotification,
  actions: NotificationActions,
): void {
  if (item.read_at === null) actions.markRead(item.id)
  const target = notificationRoute(item.payload)
  if (target) {
    actions.close()
    actions.navigate(target)
  }
}
