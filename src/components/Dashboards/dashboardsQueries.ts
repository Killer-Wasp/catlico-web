/**
 * CRUD for dashboards ("views"): a saved widget layout owned by the current
 * user, optionally shared with the organisation. Mirrors the ownership model in
 * app/api/v1/routes/metrics_dashboards.py (created_by = owner, is_public =
 * shared). Widget *data* comes from the shared `/overview` snapshot, so nothing
 * here fetches metrics.
 */
import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type { WidgetSize } from './widgets'

export type DashboardWidget = { type: string; size: WidgetSize }
export type DashboardLayout = { widgets: DashboardWidget[] }

export type Dashboard = {
  id: string
  name: string
  description: string
  layout: DashboardLayout
  /** Shared with the whole organisation (read-only for non-owners). */
  isShared: boolean
  /** The current user owns this view (may edit / share / delete). */
  isOwner: boolean
  ownerName: string | null
  ownerId: string
}

type DashboardDTO = {
  id: string
  name: string
  description: string
  // The backend stores layout as free-form JSON; only `widgets` is meaningful,
  // and it is absent on a freshly-created empty dashboard.
  layout: { widgets?: DashboardWidget[] }
  is_public: boolean
  is_owner: boolean
  owner_name: string | null
  created_by: string
}

function toDashboard(d: DashboardDTO): Dashboard {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    layout: { widgets: d.layout.widgets ?? [] },
    isShared: d.is_public,
    isOwner: d.is_owner,
    ownerName: d.owner_name,
    ownerId: d.created_by,
  }
}

async function fetchDashboards(): Promise<Dashboard[]> {
  const list = await api.get('dashboards').json<DashboardDTO[]>()
  return list.map(toDashboard)
}

export const dashboardKeys = {
  all: ['dashboards'] as const,
}

export const dashboardsQueryOptions = () =>
  queryOptions({
    queryKey: dashboardKeys.all,
    queryFn: fetchDashboards,
  })

export async function createDashboard(input: {
  name: string
  layout: DashboardLayout
  isShared?: boolean
}): Promise<Dashboard> {
  const d = await api
    .post('dashboards', {
      json: {
        name: input.name,
        layout: input.layout,
        is_public: input.isShared ?? false,
      },
    })
    .json<DashboardDTO>()
  return toDashboard(d)
}

export async function updateDashboard(input: {
  id: string
  name?: string
  layout?: DashboardLayout
  isShared?: boolean
}): Promise<Dashboard> {
  const body: Record<string, unknown> = {}
  if (input.name !== undefined) body.name = input.name
  if (input.layout !== undefined) body.layout = input.layout
  if (input.isShared !== undefined) body.is_public = input.isShared
  const d = await api
    .patch(`dashboards/${input.id}`, { json: body })
    .json<DashboardDTO>()
  return toDashboard(d)
}

export async function deleteDashboard(id: string): Promise<void> {
  await api.delete(`dashboards/${id}`)
}
