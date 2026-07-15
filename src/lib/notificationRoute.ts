/**
 * Maps a notification's `payload` envelope to a router navigation target, or
 * `null` when the notification isn't deep-linkable.
 *
 * The payload is the server's audit event envelope (see the API's
 * `build_event_envelope`): it carries `object {type, id}` — the mutated entity —
 * and `context {type, id}` — the owning entity (typically the parent case).
 * `object.type` is the model's tablename minus its SQL-escape suffix, so a case
 * is `"case"`, a KB page is `"knowledge_base_page"`, etc.
 *
 * Routing rules:
 *   - `case`  → the case (its Details tab). `object.id` is the case's integer
 *     PK, which is also the `$caseId` route param.
 *   - `alert` → the alert drawer. `object.id` is the alert id.
 *   - `observable` → the observables page. There is no open-by-id URL param
 *     (the page opens its drawer from local state), so this lands on the list.
 *   - `knowledge_base_page` → the KB page. `object.id` is the page id.
 *   - `task` / `log` → the parent CASE. `object.id` is a human public_id
 *     (e.g. `T-1234-1`), NOT a route param, so we navigate via `context.id`
 *     (the numeric case id): tasks → Tasks tab, logs → Timeline tab.
 *   - `comment` → the parent entity via `context` (a case's Comments tab —
 *     deep-linked to the comment — or the parent alert).
 *
 * Synthesized `*.assigned` / `*.mentioned` notifications reuse the same
 * envelope (their `object.type` is still the underlying entity), so they route
 * correctly through the rules above with no special-casing.
 */

export type NotificationRoute =
  | {
      to: '/cases/$caseId/$tab'
      params: { caseId: string; tab: string }
      search?: { comment: string }
    }
  | { to: '/alerts/$alertId'; params: { alertId: string } }
  | { to: '/knowledge-base/$pageId'; params: { pageId: string } }
  | { to: '/observables' }

type EntityRef = { type: string; id: string }

/** Coerce an envelope `object`/`context` node to `{type, id}`, or null. The
 * server defaults missing ids to `""` — an empty id is treated as absent. */
function normaliseRef(value: unknown): EntityRef | null {
  if (typeof value !== 'object' || value === null) return null
  const rawType = (value as { type?: unknown }).type
  const rawId = (value as { id?: unknown }).id
  const type = typeof rawType === 'string' ? rawType : ''
  const id =
    typeof rawId === 'string'
      ? rawId
      : typeof rawId === 'number'
        ? String(rawId)
        : ''
  if (!type) return null
  return { type, id }
}

function caseTab(
  caseId: string,
  tab: string,
  search?: { comment: string },
): NotificationRoute {
  return {
    to: '/cases/$caseId/$tab',
    params: { caseId, tab },
    ...(search ? { search } : {}),
  }
}

function alertPage(alertId: string): NotificationRoute {
  return { to: '/alerts/$alertId', params: { alertId } }
}

/** A comment routes to its parent entity (`context`), not to itself. */
function commentRoute(
  object: EntityRef,
  context: EntityRef | null,
): NotificationRoute | null {
  if (!context || !context.id) return null
  if (context.type === 'case') {
    return caseTab(
      context.id,
      'comments',
      object.id ? { comment: object.id } : undefined,
    )
  }
  if (context.type === 'alert') return alertPage(context.id)
  return null
}

export function notificationRoute(payload: unknown): NotificationRoute | null {
  if (typeof payload !== 'object' || payload === null) return null
  const object = normaliseRef((payload as { object?: unknown }).object)
  const context = normaliseRef((payload as { context?: unknown }).context)
  if (!object) return null

  switch (object.type) {
    case 'case':
      return object.id ? caseTab(object.id, 'details') : null
    case 'alert':
      return object.id ? alertPage(object.id) : null
    case 'observable':
      return { to: '/observables' }
    case 'knowledge_base_page':
      return object.id
        ? { to: '/knowledge-base/$pageId', params: { pageId: object.id } }
        : null
    // task/log `object.id` is a public_id (T-1234-1), not routable — go to the
    // parent case via `context.id` (the numeric case id) instead.
    case 'task':
      return context?.type === 'case' && context.id
        ? caseTab(context.id, 'tasks')
        : null
    // A work-log belongs to a task; the case has no standalone activity tab, so
    // deep-link to the parent case's Tasks tab.
    case 'log':
      return context?.type === 'case' && context.id
        ? caseTab(context.id, 'tasks')
        : null
    case 'comment':
      return commentRoute(object, context)
    default:
      return null
  }
}
