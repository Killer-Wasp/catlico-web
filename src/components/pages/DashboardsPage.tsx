import {
  createDashboard,
  dashboardKeys,
  dashboardsQueryOptions,
  deleteDashboard,
  revokeDashboardShare,
  shareDashboard,
  updateDashboard,
} from '#/components/Dashboards/dashboardsQueries'
import type {
  Dashboard,
  DashboardWidget,
} from '#/components/Dashboards/dashboardsQueries'
import {
  DEFAULT_LAYOUT,
  WIDGET_CATALOG,
  renderWidget,
} from '#/components/Dashboards/widgets'
import type { WidgetSize } from '#/components/Dashboards/widgets'
import { overviewQueryOptions } from '#/components/Overview/overviewQueries'
// Reuse the list pages' `.page` scope for the shared SOC palette vars the
// widgets read (severity / TLP colours, soft borders).
import pageClasses from '#/components/Cases/CasesPage.module.css'
import classes from './dashboards/DashboardsPage.module.css'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  CopyButton,
  Group,
  Loader,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Link2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_ID = '__default__'
const SIZE_CYCLE: WidgetSize[] = ['sm', 'md', 'lg']

const DEFAULT_VIEW: Dashboard = {
  id: DEFAULT_ID,
  name: 'SOC operations',
  description: 'Default view',
  layout: { widgets: DEFAULT_LAYOUT },
  isShared: false,
  isOwner: false,
  ownerName: null,
  ownerId: '',
  shareLinkActive: false,
}

type NameModal =
  | { mode: 'new' | 'rename' | 'saveAs'; value: string }
  | null

/** Drag-handle props (attributes + listeners) as `useSortable` returns them. */
type DragHandleProps = Pick<
  ReturnType<typeof useSortable>,
  'attributes' | 'listeners'
>

/** A drag-sortable grid cell. Exposes the drag-handle props to `children` via a
 *  render prop so the handle can live inside the cell's own controls row. */
function SortableCell({
  id,
  className,
  children,
}: {
  id: string
  className: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  return (
    <Box
      ref={setNodeRef}
      className={className}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : undefined,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      {children({ attributes, listeners })}
    </Box>
  )
}

export function DashboardsPage() {
  const queryClient = useQueryClient()
  const { data: dashboards = [] } = useQuery(dashboardsQueryOptions())
  // Dashboard-wide aggregation period (TheHive #585): widens the case-trend
  // windows across every widget on the board.
  const [trendDays, setTrendDays] = useLocalStorage({
    key: 'catlico-dashboard-range',
    defaultValue: 14,
  })
  const {
    data: metrics,
    isPending: metricsPending,
    isError: metricsError,
    refetch,
  } = useQuery(overviewQueryOptions(trendDays))

  const [selectedId, setSelectedId] = useLocalStorage({
    key: 'catlico-dashboard-view',
    defaultValue: DEFAULT_ID,
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DashboardWidget[]>([])
  const [nameModal, setNameModal] = useState<NameModal>(null)

  // Wallboard (fullscreen) mode: a CSS full-viewport overlay for wall displays,
  // upgraded to native fullscreen where the browser allows it. The CSS class is
  // the source of truth so it still works when the Fullscreen API is blocked.
  const [wallboard, setWallboard] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const enterWallboard = () => {
    setWallboard(true)
    containerRef.current?.requestFullscreen?.().catch(() => {
      // Fullscreen may be denied (no user gesture, iframe policy); the CSS
      // overlay still applies, so ignore the rejection.
    })
  }

  const exitWallboard = () => {
    setWallboard(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }

  // Keep state in sync when the user leaves native fullscreen via Esc.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setWallboard(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Unsaved-changes guard: customize mode holds an unsaved draft, so block
  // in-app navigation (with a confirm) and warn on tab close / hard reload.
  useBlocker({
    shouldBlockFn: () =>
      editing && !window.confirm('Discard unsaved dashboard changes?'),
    enableBeforeUnload: () => editing,
  })

  const views = useMemo(() => [DEFAULT_VIEW, ...dashboards], [dashboards])
  const current = views.find((v) => v.id === selectedId) ?? DEFAULT_VIEW
  const isDefault = current.id === DEFAULT_ID
  // The default template can be forked (Customize → Save creates a real view).
  const canEdit = isDefault || current.isOwner
  const widgets = editing ? draft : current.layout.widgets

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all })

  const selectView = (id: string) => {
    setEditing(false)
    setSelectedId(id)
  }

  const createMutation = useMutation({
    mutationFn: createDashboard,
    onSuccess: (created) => {
      invalidate()
      setSelectedId(created.id)
      setEditing(false)
      notifications.show({ color: 'teal', message: `Saved view “${created.name}”` })
    },
    onError: (e) =>
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Could not save view',
      }),
  })

  const updateMutation = useMutation({
    mutationFn: updateDashboard,
    onSuccess: () => invalidate(),
    onError: (e) =>
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Could not update view',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDashboard,
    onSuccess: () => {
      invalidate()
      setSelectedId(DEFAULT_ID)
      notifications.show({ message: 'View deleted' })
    },
  })

  // --- public share link ---
  // The plaintext URL is only known right after minting (the API never returns
  // it again), so it lives in local state until the modal closes.
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [mintedUrl, setMintedUrl] = useState<string | null>(null)
  const shareMutation = useMutation({
    mutationFn: (id: string) => shareDashboard(id),
    onSuccess: (url) => {
      setMintedUrl(url)
      invalidate()
    },
    onError: () => notifications.show({ color: 'red', message: 'Unable to create link' }),
  })
  const revokeShareMutation = useMutation({
    mutationFn: (id: string) => revokeDashboardShare(id),
    onSuccess: () => {
      setMintedUrl(null)
      invalidate()
      notifications.show({ message: 'Public link revoked' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Unable to revoke link' }),
  })
  const openShareModal = () => {
    setMintedUrl(null)
    setShareModalOpen(true)
  }

  // --- edit actions ---
  const startEditing = () => {
    setDraft(current.layout.widgets.map((w) => ({ ...w })))
    setEditing(true)
  }
  const cancelEditing = () => {
    setEditing(false)
    setDraft([])
  }
  const addWidget = (type: string) =>
    setDraft((d) => [...d, { type, size: WIDGET_CATALOG[type].defaultSize }])
  const removeWidget = (index: number) =>
    setDraft((d) => d.filter((_, i) => i !== index))
  const moveWidget = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d]
      const target = index + dir
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  // Drag-to-reorder (customize mode). Sortable ids are the draft indices; on drop
  // we arrayMove the draft. The chevron buttons stay for keyboard/a11y users.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDraft((d) => arrayMove(d, Number(active.id), Number(over.id)))
  }

  // Shared cell body (controls + widget), so the editing/non-editing branches
  // don't duplicate the widget render. `handle` supplies drag-handle props when
  // the cell is sortable.
  const renderCellInner = (
    w: DashboardWidget,
    index: number,
    handle?: DragHandleProps,
  ): ReactNode => (
    <>
      {editing && (
        <div className={classes.controls}>
          {handle && (
            <Tooltip label="Drag to reorder" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Drag to reorder"
                style={{ cursor: 'grab' }}
                {...handle.attributes}
                {...handle.listeners}
              >
                <GripVertical size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Move earlier" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => moveWidget(index, -1)}
              disabled={index === 0}
            >
              <ChevronUp size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Move later" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => moveWidget(index, 1)}
              disabled={index === widgets.length - 1}
            >
              <ChevronDown size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Resize" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => resizeWidget(index)}
            >
              <Maximize2 size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => removeWidget(index)}
            >
              <X size={15} />
            </ActionIcon>
          </Tooltip>
        </div>
      )}
      {metrics && renderWidget(w.type, metrics)}
    </>
  )
  const resizeWidget = (index: number) =>
    setDraft((d) =>
      d.map((w, i) =>
        i === index
          ? {
              ...w,
              size: SIZE_CYCLE[(SIZE_CYCLE.indexOf(w.size) + 1) % SIZE_CYCLE.length],
            }
          : w,
      ),
    )

  const saveEditing = () => {
    if (isDefault) {
      // Forking the default template into the user's own saved view.
      setNameModal({ mode: 'saveAs', value: 'My dashboard' })
      return
    }
    updateMutation.mutate(
      { id: current.id, layout: { widgets: draft } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const submitName = () => {
    if (!nameModal) return
    const name = nameModal.value.trim()
    if (!name) return
    if (nameModal.mode === 'rename') {
      updateMutation.mutate({ id: current.id, name })
    } else if (nameModal.mode === 'new') {
      createMutation.mutate({ name, layout: { widgets: DEFAULT_LAYOUT } })
    } else {
      // saveAs: persist the edited default as a new owned view.
      createMutation.mutate({ name, layout: { widgets: draft } })
    }
    setNameModal(null)
  }

  const toggleShare = () =>
    updateMutation.mutate(
      { id: current.id, isShared: !current.isShared },
      {
        onSuccess: (d) =>
          notifications.show({
            message: d.isShared
              ? 'Shared with your organisation'
              : 'Now private to you',
          }),
      },
    )

  const selectData = useMemo(() => {
    const mine = dashboards.filter((d) => d.isOwner)
    const shared = dashboards.filter((d) => !d.isOwner)
    const groups: { group: string; items: { value: string; label: string }[] }[] = [
      { group: 'Templates', items: [{ value: DEFAULT_ID, label: 'SOC operations (default)' }] },
    ]
    if (mine.length)
      groups.push({ group: 'My dashboards', items: mine.map((d) => ({ value: d.id, label: d.name })) })
    if (shared.length)
      groups.push({
        group: 'Shared with org',
        items: shared.map((d) => ({ value: d.id, label: d.name })),
      })
    return groups
  }, [dashboards])

  return (
    <Box
      ref={containerRef}
      className={`${pageClasses.page} ${wallboard ? classes.wallboard : ''}`}
      data-wallboard={wallboard || undefined}
    >
      <Modal
        opened={nameModal !== null}
        onClose={() => setNameModal(null)}
        title={
          nameModal?.mode === 'rename'
            ? 'Rename view'
            : nameModal?.mode === 'new'
              ? 'New dashboard view'
              : 'Save as new view'
        }
      >
        <Stack gap="md">
          <TextInput
            data-autofocus
            label="View name"
            value={nameModal?.value ?? ''}
            onChange={(e) =>
              setNameModal((m) => (m ? { ...m, value: e.currentTarget.value } : m))
            }
            onKeyDown={(e) => e.key === 'Enter' && submitName()}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNameModal(null)}>
              Cancel
            </Button>
            <Button onClick={submitName} loading={createMutation.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Public share link"
      >
        <Stack gap="md">
          <Text fz="sm" c="dimmed">
            Anyone with the link can view this dashboard read-only, without
            signing in. It shows the same widgets, refreshed live.
          </Text>

          {mintedUrl ? (
            <>
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <TextInput
                  flex={1}
                  readOnly
                  label="Share link"
                  value={mintedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <CopyButton value={mintedUrl}>
                  {({ copied, copy }) => (
                    <Button
                      variant={copied ? 'filled' : 'default'}
                      color={copied ? 'green' : undefined}
                      onClick={copy}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <Text fz="xs" c="dimmed">
                Copy it now — for security the link isn’t stored and won’t be
                shown again. You can always regenerate it here.
              </Text>
            </>
          ) : current.shareLinkActive ? (
            <Text fz="sm">
              A public link is active. Its URL was shown only when created and
              isn’t stored — regenerate to get a fresh link (which invalidates
              the old one), or revoke to disable sharing.
            </Text>
          ) : (
            <Text fz="sm">No public link yet.</Text>
          )}

          <Group justify="space-between">
            {current.shareLinkActive ? (
              <Button
                variant="subtle"
                color="red"
                loading={revokeShareMutation.isPending}
                onClick={() => revokeShareMutation.mutate(current.id)}
              >
                Revoke link
              </Button>
            ) : (
              <span />
            )}
            <Button
              leftSection={<Link2 size={16} />}
              loading={shareMutation.isPending}
              onClick={() => shareMutation.mutate(current.id)}
            >
              {current.shareLinkActive ? 'Regenerate link' : 'Create link'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* --- Title + toolbar --- */}
      <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
        <Box>
          <Group gap="sm" align="center">
            <Title order={1} fz={30} fw={700}>
              Dashboards
            </Title>
            {!isDefault && current.isShared && (
              <Badge variant="light" color="blue" leftSection={<Share2 size={12} />}>
                Shared
              </Badge>
            )}
            {!isDefault && !current.isOwner && (
              <Badge variant="light" color="gray">
                {current.ownerName ? `by ${current.ownerName}` : 'Shared'}
              </Badge>
            )}
          </Group>
          <Text ff="monospace" fz={13} c="dimmed" mt={4}>
            {metrics ? dayjsLabel(metrics.generatedAt) : 'Live SOC metrics'}
          </Text>
        </Box>

        <Group gap="sm" className={classes.noPrint}>
          <Select
            data={selectData}
            value={current.id}
            onChange={(v) => v && selectView(v)}
            allowDeselect={false}
            w={230}
            aria-label="Select dashboard view"
          />

          {editing ? (
            <>
              <Menu position="bottom-end" width={240} shadow="md">
                <Menu.Target>
                  <Button variant="default" leftSection={<Plus size={16} />}>
                    Add widget
                  </Button>
                </Menu.Target>
                <Menu.Dropdown mah={420} style={{ overflowY: 'auto' }}>
                  {CATEGORY_ORDER.map((cat) => (
                    <div key={cat}>
                      <Menu.Label>{cat}</Menu.Label>
                      {Object.entries(WIDGET_CATALOG)
                        .filter(([, w]) => w.category === cat)
                        .map(([type, w]) => (
                          <Menu.Item key={type} onClick={() => addWidget(type)}>
                            {w.title}
                          </Menu.Item>
                        ))}
                    </div>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <Button
                variant="default"
                onClick={cancelEditing}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                color="orange"
                onClick={saveEditing}
                loading={updateMutation.isPending}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <SegmentedControl
                value={String(trendDays)}
                onChange={(v) => setTrendDays(Number(v))}
                data={[
                  { value: '7', label: '7d' },
                  { value: '14', label: '14d' },
                  { value: '30', label: '30d' },
                ]}
                aria-label="Trend window"
              />
              <Tooltip label="Print / save as PDF" withArrow>
                <Button
                  variant="default"
                  leftSection={<Printer size={16} />}
                  onClick={() => window.print()}
                >
                  Export PDF
                </Button>
              </Tooltip>
              <Tooltip
                label={wallboard ? 'Exit fullscreen' : 'Fullscreen wallboard'}
                withArrow
              >
                <Button
                  variant="default"
                  aria-label={
                    wallboard ? 'Exit fullscreen' : 'Fullscreen wallboard'
                  }
                  leftSection={
                    wallboard ? (
                      <Minimize2 size={16} />
                    ) : (
                      <Maximize2 size={16} />
                    )
                  }
                  onClick={wallboard ? exitWallboard : enterWallboard}
                >
                  {wallboard ? 'Exit' : 'Fullscreen'}
                </Button>
              </Tooltip>
              {canEdit && (
                <Button
                  variant="default"
                  leftSection={<Pencil size={16} />}
                  onClick={startEditing}
                >
                  Customize
                </Button>
              )}
              <Menu position="bottom-end" width={200} shadow="md">
                <Menu.Target>
                  <Button variant="default" px={10}>
                    ⋯
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<Plus size={15} />}
                    onClick={() => setNameModal({ mode: 'new', value: '' })}
                  >
                    New view
                  </Menu.Item>
                  {current.isOwner && !isDefault && (
                    <>
                      <Menu.Item
                        leftSection={<Pencil size={15} />}
                        onClick={() =>
                          setNameModal({ mode: 'rename', value: current.name })
                        }
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<Share2 size={15} />}
                        onClick={toggleShare}
                      >
                        {current.isShared ? 'Make private' : 'Share with org'}
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<Link2 size={15} />}
                        onClick={openShareModal}
                      >
                        {current.shareLinkActive
                          ? 'Public link…'
                          : 'Create public link…'}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<Trash2 size={15} />}
                        onClick={() => {
                          if (
                            window.confirm(`Delete view “${current.name}”?`)
                          )
                            deleteMutation.mutate(current.id)
                        }}
                      >
                        Delete view
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </>
          )}
        </Group>
      </Group>

      {/* --- Widget grid --- */}
      {metricsPending ? (
        <Center mih={400}>
          <Loader />
        </Center>
      ) : metricsError ? (
        <Stack align="center" mih={400} justify="center" gap="sm">
          <Text c="dimmed">Couldn’t load metrics from the backend.</Text>
          <Button variant="default" onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      ) : widgets.length === 0 ? (
        <Box className={classes.emptyState}>
          <Text c="dimmed">
            This view has no widgets.{' '}
            {editing ? 'Use “Add widget” to build it.' : 'Customize it to add some.'}
          </Text>
        </Box>
      ) : editing ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={widgets.map((_, i) => String(i))}
            strategy={rectSortingStrategy}
          >
            <Box className={`${classes.grid} ${classes.editing}`}>
              {widgets.map((w, index) => (
                <SortableCell
                  key={`${w.type}-${index}`}
                  id={String(index)}
                  className={`${classes.cell} ${classes[w.size]}`}
                >
                  {(handle) => renderCellInner(w, index, handle)}
                </SortableCell>
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      ) : (
        <Box className={classes.grid}>
          {widgets.map((w, index) => (
            <Box
              key={`${w.type}-${index}`}
              className={`${classes.cell} ${classes[w.size]}`}
            >
              {renderCellInner(w, index)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

const CATEGORY_ORDER = ['KPI', 'Cases', 'Alerts', 'Team', 'SLA'] as const

function dayjsLabel(iso: string): string {
  // Local, lightweight — avoids pulling dayjs config into this file.
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
