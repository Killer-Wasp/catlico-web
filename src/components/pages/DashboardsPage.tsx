import {
  createDashboard,
  dashboardKeys,
  dashboardsQueryOptions,
  deleteDashboard,
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
  ChevronDown,
  ChevronUp,
  Maximize2,
  Pencil,
  Plus,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'

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
}

type NameModal =
  | { mode: 'new' | 'rename' | 'saveAs'; value: string }
  | null

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
    <Box className={pageClasses.page}>
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
      ) : (
        <Box className={`${classes.grid} ${editing ? classes.editing : ''}`}>
          {widgets.map((w, index) => (
            <Box
              key={`${w.type}-${index}`}
              className={`${classes.cell} ${classes[w.size]}`}
            >
              {editing && (
                <div className={classes.controls}>
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
              {renderWidget(w.type, metrics)}
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
