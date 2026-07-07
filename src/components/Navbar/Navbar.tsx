import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Cable,
  ClipboardList,
  Eye,
  Gauge,
  Grid3x3,
  LayoutDashboard,
  ListTodo,
  ListFilter,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  SquareFunction,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  ActionIcon,
  Badge,
  Box,
  Flex,
  Image,
  Indicator,
  NavLink,
  Text,
  Tooltip,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import {
  analyzerJobsQueryOptions,
  countConnectorJobsByTab,
} from '#/components/Connectors/connectorJobs'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import {
  OPEN_TASK_FILTERS,
  tasksQueryOptions,
} from '#/components/Tasks/tasksQueries'

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
  connectors?: number
  connectorJobs?: number
  caseTemplates: number
}

function sectionsForCounts(counts: NavbarCounts): NavSection[] {
  return [
    {
      title: 'Operate',
      items: [
        { icon: LayoutDashboard, label: 'Overview', to: '/' },
        { icon: Gauge, label: 'Dashboards' },
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
        { icon: Grid3x3, label: 'ATT&CK matrix' },
        {
          icon: Cable,
          label: 'Connectors',
          to: '/connectors',
          badge: counts.connectors,
        },
        {
          icon: ListFilter,
          label: 'Analyzer jobs',
          to: '/connector-jobs',
          badge: counts.connectorJobs,
        },
      ],
    },
    {
      title: 'Automate',
      items: [
        { icon: SquareFunction, label: 'Functions', to: '/functions' },
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
        { icon: ScrollText, label: 'Audit trail' },
        { icon: Settings, label: 'Settings', to: '/settings' },
      ],
    },
  ]
}

// Active links flip to a high-contrast dark fill; danger links read red.
// `light-dark()` mirrors theme.ts so both colour schemes stay on-palette.
function linkStyle(active: boolean, danger?: boolean) {
  const radius = { borderRadius: 'var(--mantine-radius-md)' }
  if (active) {
    return {
      ...radius,
      backgroundColor:
        'light-dark(var(--mantine-color-dark-9), var(--mantine-color-gray-0))',
      color:
        'light-dark(var(--mantine-color-white), var(--mantine-color-dark-9))',
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

export function Navbar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { pathname } = useLocation()
  const { data: alerts } = useQuery(alertsQueryOptions())
  const { data: cases } = useQuery(casesQueryOptions())
  const { data: observables } = useQuery(observablesQueryOptions())
  // Server-side count of open tasks (the list itself is paginated, so counting
  // fetched rows would only see one page).
  const { data: openTasks } = useQuery(tasksQueryOptions(OPEN_TASK_FILTERS))
  const { data: connectors } = useQuery(connectorsQueryOptions())
  const { data: connectorJobs } = useQuery(analyzerJobsQueryOptions())
  const { data: caseTemplates } = useQuery(caseTemplatesQueryOptions())
  const connectorJobCounts = connectorJobs
    ? countConnectorJobsByTab(connectorJobs)
    : undefined
  const sections = sectionsForCounts({
    tasks: openTasks?.total,
    alerts: alerts?.total,
    cases: cases?.total,
    observables: observables?.total,
    connectors: connectors?.length,
    connectorJobs: connectorJobCounts
      ? connectorJobCounts.queued + connectorJobCounts.running
      : undefined,
    caseTemplates: caseTemplates?.total ?? 0,
  })

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
        align="center"
        justify={collapsed ? 'center' : 'flex-start'}
        px={collapsed ? 0 : 'sm'}
        py="sm"
        style={{
          flexShrink: 0,
          borderTop:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
        }}
      >
        <Tooltip
          label="Expand"
          position="right"
          withArrow
          disabled={!collapsed}
          transitionProps={{ duration: 0 }}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </ActionIcon>
        </Tooltip>
      </Flex>
    </Flex>
  )
}
