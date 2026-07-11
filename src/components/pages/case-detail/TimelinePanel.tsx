import type { CaseDetailTimelineEvent } from '#/components/Cases/caseDetails.types'
import { caseTimelineQueryOptions } from '#/components/Cases/casesQueries'
import { Box, Group, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Circle,
  Clock,
  FileText,
  Folder,
  Fingerprint,
  ListChecks,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { CasePanelHeader } from './CasePanelHeader'

// A Mantine colour name per event: comments stand apart, and audit rows are
// coloured by their action (create/update/delete) so the stream reads at a glance.
function eventColor(event: CaseDetailTimelineEvent): string {
  if (event.kind === 'comment') return 'grape'
  switch (event.action) {
    case 'create':
      return 'teal'
    case 'delete':
      return 'red'
    case 'update':
      return 'blue'
    default:
      return 'gray'
  }
}

// The marker icon: comments get a speech bubble; audit rows get an icon for the
// object they touched (task/observable/alert/…), which tells you *what* changed
// at a glance while the colour tells you *how*.
const OBJECT_ICON: Record<string, LucideIcon> = {
  task: ListChecks,
  observable: Fingerprint,
  alert: TriangleAlert,
  case: Folder,
  log: FileText,
}

function eventIcon(event: CaseDetailTimelineEvent): LucideIcon {
  if (event.kind === 'comment') return MessageSquare
  return OBJECT_ICON[event.objectType ?? ''] ?? Circle
}

const VERB: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

// "Created task" / "Updated alert" — the leading phrase for an audit row.
function verbPhrase(event: CaseDetailTimelineEvent): string {
  const action = event.action ?? ''
  const verb = VERB[action] ?? action.charAt(0).toUpperCase() + action.slice(1)
  return event.objectType ? `${verb} ${event.objectType}` : verb
}

const START_OF_DAY = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// "Today" / "Yesterday" / "Wed, 8 Jul 2026" — the header for a day's group.
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.round((START_OF_DAY(new Date()) - START_OF_DAY(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Wall-clock time in the viewer's own timezone (the previous "12:52 pm AEST"
// hard-coded a timezone that may not be the viewer's).
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Group the already-newest-first stream into consecutive same-day buckets.
function groupByDay(events: CaseDetailTimelineEvent[]) {
  const groups: { day: string; events: CaseDetailTimelineEvent[] }[] = []
  for (const event of events) {
    const day = dayLabel(event.createdAt)
    const last = groups.at(-1)
    if (last && last.day === day) last.events.push(event)
    else groups.push({ day, events: [event] })
  }
  return groups
}

function Marker({ event }: { event: CaseDetailTimelineEvent }) {
  const Icon = eventIcon(event)
  return (
    <ThemeIcon
      size={30}
      radius="xl"
      variant="light"
      color={eventColor(event)}
      style={{ flexShrink: 0, zIndex: 1 }}
    >
      <Icon size={15} />
    </ThemeIcon>
  )
}

function TimelineRow({ event }: { event: CaseDetailTimelineEvent }) {
  if (event.kind === 'comment') {
    return (
      <Group gap="sm" align="flex-start" wrap="nowrap" py={10}>
        <Marker event={event} />
        <Box flex={1} miw={0}>
          <Group gap={8} mb={2}>
            <Text fw={600} fz={14}>
              {event.who}
            </Text>
            <Text fz={12} c="dimmed">
              commented &middot; {timeLabel(event.createdAt)}
            </Text>
          </Group>
          <Text fz={14} style={{ whiteSpace: 'pre-wrap' }}>
            {event.text}
          </Text>
        </Box>
      </Group>
    )
  }

  const label = event.text ? (
    event.link ? (
      <Text
        component={Link}
        to={event.link}
        fw={600}
        style={{ textDecoration: 'none', cursor: 'pointer' }}
      >
        {event.text}
      </Text>
    ) : (
      <Text component="span" fw={600}>
        {event.text}
      </Text>
    )
  ) : null

  return (
    <Group gap="sm" align="flex-start" wrap="nowrap" py={10}>
      <Marker event={event} />
      <Box flex={1} miw={0}>
        <Text fz={14}>
          <Text component="span" c="dimmed">
            {verbPhrase(event)}
          </Text>
          {label ? <> {label}</> : null}
        </Text>
        <Text fz={12} c="dimmed" mt={2}>
          {event.who} &middot; {timeLabel(event.createdAt)}
        </Text>
      </Box>
    </Group>
  )
}

// The connector line runs behind the markers; markers are 30px, so its centre
// sits at 15px from the left edge of the rail.
function DayGroup({
  day,
  events,
}: {
  day: string
  events: CaseDetailTimelineEvent[]
}) {
  return (
    <Box>
      <Text tt="uppercase" fz={11} fw={700} c="dimmed" mb={4} ml={2}>
        {day}
      </Text>
      <Box style={{ position: 'relative' }}>
        <Box
          style={{
            position: 'absolute',
            left: 15,
            top: 18,
            bottom: 18,
            width: 2,
            background: 'var(--line-soft)',
          }}
        />
        <Stack gap={0}>
          {events.map((event, index) => (
            <TimelineRow key={`${event.kind}-${event.createdAt}-${index}`} event={event} />
          ))}
        </Stack>
      </Box>
    </Box>
  )
}

function TimelineSkeleton() {
  return (
    <Stack gap="lg">
      {[0, 1].map((group) => (
        <Box key={group}>
          <Skeleton height={10} width={90} radius="sm" mb="sm" />
          <Stack gap="lg">
            {[0, 1, 2].map((row) => (
              <Group key={row} gap="sm" wrap="nowrap" align="flex-start">
                <Skeleton height={30} circle />
                <Stack gap={6} flex={1}>
                  <Skeleton height={12} width="55%" radius="sm" />
                  <Skeleton height={10} width="30%" radius="sm" />
                </Stack>
              </Group>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}

function EmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <Group justify="center" c="dimmed" gap="xs" py={60}>
      {icon}
      <Text fz={14}>{message}</Text>
    </Group>
  )
}

export function TimelinePanel({ caseId }: { caseId: string }) {
  const {
    data: timeline = [],
    isPending,
    isError,
  } = useQuery(caseTimelineQueryOptions(caseId))

  const groups = groupByDay(timeline)

  return (
    <Stack gap="lg" p="lg">
      <CasePanelHeader label="Timeline" />

      {isPending ? (
        <TimelineSkeleton />
      ) : isError ? (
        <EmptyState
          icon={<TriangleAlert size={18} />}
          message="Couldn't load the case timeline."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Clock size={18} />}
          message="No activity on this case yet."
        />
      ) : (
        <Stack gap="lg">
          {groups.map((group) => (
            <DayGroup key={group.day} day={group.day} events={group.events} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
