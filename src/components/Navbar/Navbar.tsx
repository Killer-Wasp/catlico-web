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
  ScrollText,
  Settings,
  SquareFunction,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Box, Flex, Image, NavLink, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { alertsQueryOptions } from '#/components/Alerts/alertsQueries'
import { caseTemplatesList } from '#/components/Cases/caseTemplates'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import {
  analyzerJobsQueryOptions,
  countConnectorJobsByTab,
} from '#/components/Connectors/connectorJobs'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import { filterTasksByStatus, initialTasks } from '#/components/Tasks/tasks'
import { tasksQueryOptions } from '#/components/Tasks/tasksQueries'

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
  tasks: number
  observables?: number
  connectors?: number
  connectorJobs?: number
  caseTemplates: number
}

const fixtureCounts = {
  tasks: filterTasksByStatus(initialTasks, 'open').length,
  caseTemplates: caseTemplatesList.length,
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

function NavItemLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
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

export function Navbar() {
  const { pathname } = useLocation()
  const { data: alerts } = useQuery(alertsQueryOptions())
  const { data: cases } = useQuery(casesQueryOptions())
  const { data: observables } = useQuery(observablesQueryOptions())
  const { data: taskQueue } = useQuery(tasksQueryOptions())
  const { data: connectors } = useQuery(connectorsQueryOptions())
  const { data: connectorJobs } = useQuery(analyzerJobsQueryOptions())
  const connectorJobCounts = connectorJobs
    ? countConnectorJobsByTab(connectorJobs)
    : undefined
  const sections = sectionsForCounts({
    ...fixtureCounts,
    tasks: filterTasksByStatus(taskQueue?.tasks ?? initialTasks, 'open').length,
    alerts: alerts?.length,
    cases: cases?.total,
    observables: observables?.length,
    connectors: connectors?.length,
    connectorJobs: connectorJobCounts
      ? connectorJobCounts.queued + connectorJobCounts.running
      : undefined,
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
        gap={12}
        h={64}
        px="md"
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
      </Flex>

      <Box px="sm" py="md" style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((section) => (
          <Box key={section.title} mb="lg">
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
            {section.items.map((item) => {
              const active =
                item.to === pathname ||
                (item.to !== '/' &&
                  item.to !== undefined &&
                  pathname.startsWith(`${item.to}/`))
              return (
                <NavItemLink key={item.label} item={item} active={active} />
              )
            })}
          </Box>
        ))}
      </Box>
    </Flex>
  )
}
