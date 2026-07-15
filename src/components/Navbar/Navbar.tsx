import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Building2,
  ClipboardList,
  Eye,
  Gauge,
  Grid3x3,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Puzzle,
  Server,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Badge,
  Box,
  Flex,
  Image,
  Indicator,
  NavLink,
  Select,
  Text,
  Tooltip,
} from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { pluginsQueryOptions } from '#/components/Plugins/plugins'
import {
  pluginRunsQueryOptions,
} from '#/components/Plugins/pluginRuns'
import { pluginRunnersQueryOptions } from '#/components/Plugins/pluginRunners'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import {
  OPEN_TASK_FILTERS,
  tasksQueryOptions,
} from '#/components/Tasks/tasksQueries'
import { accessibleOrganisationsQueryOptions } from '#/components/pages/settings/settingsQueries'
import { getActiveOrgId } from '#/lib/auth/session'
import { useState } from 'react'

type NavItem = {
  icon: LucideIcon
  label: string
  to?: string
  badge?: number
  badgeColor?: 'red' | 'gray'
  danger?: boolean
}

type NavSection = {
  title: string
  items: NavItem[]
}

type NavbarCounts = {
  alerts?: number
  cases?: number
  tasks?: number
  observables?: number
  plugins?: number
  pluginRuns?: number
  pluginRunners?: number
  caseTemplates: number
}

function sectionsForCounts(counts: NavbarCounts): NavSection[] {
  return [
    {
      title: 'Operate',
      items: [
        { icon: LayoutDashboard, label: 'Overview', to: '/' },
        { icon: Gauge, label: 'Dashboards', to: '/dashboards' },
        {
          icon: AlertTriangle,
          label: 'Alerts',
          to: '/alerts',
          badge: counts.alerts,
          badgeColor: 'red',
        },
        { icon: Briefcase, label: 'Cases', to: '/cases', badge: counts.cases },
        { icon: ListTodo, label: 'Tasks', to: '/tasks', badge: counts.tasks },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        {
          icon: Eye,
          label: 'Observables',
          to: '/observables',
          badge: counts.observables,
        },
        { icon: Grid3x3, label: 'ATT&CK matrix', to: '/attack-matrix' },
        {
          icon: Puzzle,
          label: 'Plugins',
          to: '/plugins',
          badge: counts.plugins,
        },
        {
          icon: Play,
          label: 'Plugin runs',
          to: '/plugin-runs',
          badge: counts.pluginRuns,
        },
        {
          icon: Server,
          label: 'Plugin runners',
          to: '/plugin-runners',
          badge: counts.pluginRunners,
        },
      ],
    },
    {
      title: 'Automate',
      items: [
        { icon: BookOpen, label: 'Knowledge base', to: '/knowledge-base' },
      ],
    },
    {
      title: 'Manage',
      items: [
        {
          icon: ClipboardList,
          label: 'Case templates',
          to: '/case-templates',
          badge: counts.caseTemplates,
        },
        { icon: Settings, label: 'Settings', to: '/settings' },
      ],
    },
  ]
}

// Active links flip to a high-contrast fill; danger links read red.
// `light-dark()` mirrors theme.ts so both colour schemes stay on-palette.
function linkStyle(active: boolean, danger?: boolean) {
  const radius = { borderRadius: 'var(--mantine-radius-md)' }
  if (active) {
    return {
      ...radius,
      backgroundColor:
        'light-dark(var(--mantine-color-dark-9), var(--mantine-color-dark-6))',
      color:
        'light-dark(var(--mantine-color-white), var(--mantine-color-dark-0))',
    }
  }
  if (danger) {
    return { ...radius, color: 'var(--mantine-color-red-6)' }
  }
  return radius
}

// Icons sit a shade dimmer than the label when idle, but inherit the
// link colour once active or flagged danger.
function iconColor(active: boolean, danger?: boolean) {
  if (active) return 'inherit'
  if (danger) return 'var(--mantine-color-red-6)'
  return 'light-dark(var(--mantine-color-gray-6), var(--mantine-color-dark-2))'
}

function NavItemLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  // Collapsed rail: icon only, centred, with the label surfaced as a
  // right-side tooltip (mirrors Mantine's NavbarMinimal). Numeric badges
  // don't fit an 80px rail, so a count collapses to an Indicator dot.
  if (collapsed) {
    return (
      <Tooltip
        label={item.label}
        position="right"
        withArrow
        transitionProps={{ duration: 0 }}
      >
        <NavLink
          component={item.to ? Link : undefined}
          to={item.to}
          active={active}
          variant="subtle"
          color="gray"
          aria-label={item.label}
          leftSection={
            <Indicator
              disabled={!item.badge}
              color={item.badgeColor === 'red' ? 'red' : 'gray'}
              size={8}
              offset={2}
              withBorder
            >
              <Icon
                size={20}
                style={{
                  color: iconColor(active, item.danger),
                  display: 'block',
                }}
              />
            </Indicator>
          }
          styles={{
            root: {
              width: 44,
              height: 44,
              marginInline: 'auto',
              marginBottom: 4,
              padding: 0,
              justifyContent: 'center',
              alignItems: 'center',
            },
            body: { display: 'none' },
            section: { marginInlineStart: 0, marginInlineEnd: 0 },
          }}
          style={linkStyle(active, item.danger)}
        />
      </Tooltip>
    )
  }

  return (
    <NavLink
      component={item.to ? Link : undefined}
      to={item.to}
      active={active}
      variant="subtle"
      color="gray"
      label={item.label}
      fw={600}
      leftSection={
        <Icon size={20} style={{ color: iconColor(active, item.danger) }} />
      }
      rightSection={
        item.badge !== undefined ? (
          <Badge
            variant={item.badgeColor === 'red' ? 'outline' : 'default'}
            color={item.badgeColor === 'red' ? 'red' : 'gray'}
            radius="xl"
            size="sm"
            fw={600}
            style={{ pointerEvents: 'none' }}
          >
            {item.badge}
          </Badge>
        ) : undefined
      }
      style={linkStyle(active, item.danger)}
    />
  )
}

function NavControlItem({
  collapsed,
  icon: Icon,
  label,
  onClick,
}: {
  collapsed: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  if (collapsed) {
    return (
      <Tooltip
        label={label}
        position="right"
        withArrow
        transitionProps={{ duration: 0 }}
      >
        <NavLink
          component="button"
          aria-label={label}
          leftSection={<Icon size={20} />}
          onClick={onClick}
          variant="subtle"
          color="gray"
          styles={{
            root: {
              width: 44,
              height: 44,
              marginInline: 'auto',
              marginBottom: 4,
              padding: 0,
              justifyContent: 'center',
              alignItems: 'center',
            },
            body: { display: 'none' },
            section: { marginInlineStart: 0, marginInlineEnd: 0 },
          }}
          style={linkStyle(false)}
        />
      </Tooltip>
    )
  }

  return (
    <NavLink
      component="button"
      label={label}
      aria-label={label}
      leftSection={<Icon size={20} />}
      onClick={onClick}
      variant="subtle"
      color="gray"
      fw={600}
      style={linkStyle(false)}
    />
  )
}

export function Navbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const [activeOrgId, setActiveOrgId] = useState(() => getActiveOrgId())
  const { data: alerts } = useQuery(alertsQueryOptions())
  const { data: cases } = useQuery(casesQueryOptions())
  const { data: observables } = useQuery(observablesQueryOptions())
  // Server-side count of open tasks (the list itself is paginated, so counting
  // fetched rows would only see one page).
  const { data: openTasks } = useQuery(tasksQueryOptions(OPEN_TASK_FILTERS))
  const { data: plugins } = useQuery(pluginsQueryOptions())
  const { data: pluginRunsData } = useQuery(
    pluginRunsQueryOptions({ limit: 1 }),
  )
  const { data: pluginRunners } = useQuery(pluginRunnersQueryOptions())
  const { data: caseTemplates } = useQuery(caseTemplatesQueryOptions())
  const { data: organisations } = useQuery(
    accessibleOrganisationsQueryOptions(),
  )
  const sections = sectionsForCounts({
    tasks: openTasks?.total,
    alerts: alerts?.total,
    cases: cases?.total,
    observables: observables?.total,
    plugins: plugins?.length,
    pluginRuns: pluginRunsData?.total,
    pluginRunners: pluginRunners?.length,
    caseTemplates: caseTemplates?.total ?? 0,
  })
  const organisationOptions = (organisations ?? []).map((organisation) => ({
    value: organisation.id,
    label: organisation.name,
  }))
  const activeOrganisationLabel =
    organisationOptions.find((option) => option.value === activeOrgId)?.label ??
    activeOrgId ??
    'No organisation'

  const setActiveOrganisation = (orgId: string | null) => {
    if (!orgId) return
    localStorage.setItem('catlico.orgId', orgId)
    // Same-tab signal so listeners keyed on the active org (e.g. the header's
    // notification socket) can react — the `storage` event only fires in OTHER
    // tabs, never the one that wrote.
    window.dispatchEvent(new Event('catlico:org-changed'))
    setActiveOrgId(orgId)
    void queryClient.invalidateQueries()
  }

  return (
    <Flex
      component="nav"
      direction="column"
      h="100%"
      w="100%"
      style={{ backgroundColor: 'var(--mantine-color-body)' }}
    >
      <Flex
        align="center"
        gap={10}
        h={64}
        px={collapsed ? 0 : 'md'}
        justify={collapsed ? 'center' : 'flex-start'}
        style={{
          flexShrink: 0,
          borderBottom:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
        }}
      >
        <Image
          src="/catlico-logo.png"
          alt="Catlico"
          w={44}
          h={44}
          style={{
            flexShrink: 0,
            borderRadius: '50%',
            // Soft ring + lift so the cream badge reads on a white nav.
            boxShadow:
              '0 0 0 1px light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4)), 0 2px 6px rgba(31, 31, 30, 0.12)',
          }}
        />
        {!collapsed && (
          <Text
            ff="'Space Grotesk', var(--mantine-font-family)"
            fz={25}
            fw={700}
            lts="0.06em"
            tt="uppercase"
            variant="gradient"
            gradient={{ from: 'orange.6', to: 'dark.9', deg: 105 }}
            style={{ lineHeight: 1 }}
          >
            Catlico
          </Text>
        )}
      </Flex>

      <Box
        px={collapsed ? 'xs' : 'sm'}
        py="md"
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {sections.map((section) => (
          <Box key={section.title} mb="lg">
            {!collapsed && (
              <Text
                fz={11}
                fw={600}
                lts="0.1em"
                tt="uppercase"
                c="dimmed"
                px="sm"
                mb={6}
              >
                {section.title}
              </Text>
            )}
            {section.items.map((item) => {
              const active =
                item.to === pathname ||
                (item.to !== '/' &&
                  item.to !== undefined &&
                  pathname.startsWith(`${item.to}/`))
              return (
                <NavItemLink
                  key={item.label}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                />
              )
            })}
          </Box>
        ))}
      </Box>

      <Flex
        direction="column"
        gap={8}
        px={collapsed ? 0 : 'sm'}
        py="sm"
        style={{
          flexShrink: 0,
          borderTop:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
        }}
      >
        {collapsed ? (
          <Tooltip
            label={activeOrganisationLabel}
            position="right"
            withArrow
            transitionProps={{ duration: 0 }}
          >
            <NavLink
              component="button"
              aria-label={`Active organisation: ${activeOrganisationLabel}`}
              leftSection={<Building2 size={20} />}
              variant="subtle"
              color="gray"
              styles={{
                root: {
                  width: 44,
                  height: 44,
                  marginInline: 'auto',
                  padding: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                body: { display: 'none' },
                section: { marginInlineStart: 0, marginInlineEnd: 0 },
              }}
              style={linkStyle(false)}
            />
          </Tooltip>
        ) : (
          <Select
            aria-label="Active organisation"
            data={organisationOptions}
            value={activeOrgId}
            onChange={setActiveOrganisation}
            leftSection={<Building2 size={16} />}
            allowDeselect={false}
            size="xs"
          />
        )}
        <NavControlItem
          collapsed={collapsed}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={onToggle}
        />
      </Flex>
    </Flex>
  )
}
