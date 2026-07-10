import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Group,
  Pagination,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Severity } from '#/components/Severity/Severity'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Snippet } from '#/components/Search/Snippet'
import { SEARCH_TYPES, hitRoute, searchQueryOptions } from '#/lib/search'
import type { SearchEntityType } from '#/lib/search'
import type { CaseStatus, Severity as SeverityLevel } from '#/lib/domain'
import { TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '#/components/Tasks/tasks'
import type { TaskStatus } from '#/components/Tasks/tasks.types'

const PAGE_SIZE = 25

type SearchPageParams = { q: string; type: SearchEntityType; page: number }

/**
 * Parses `?q=&type=&page=` off the URL. This is the guard that keeps a
 * hand-edited URL from reaching the API with a bad `offset`, so it is exported
 * for direct testing.
 */
export function validateSearchParams(search: Record<string, unknown>): SearchPageParams {
  const type = SEARCH_TYPES.includes(search.type as SearchEntityType)
    ? (search.type as SearchEntityType)
    : 'case'
  // `Number(undefined)` / `Number('abc')` are NaN, and `Number('1e400')` is
  // Infinity — `Number.isInteger` rejects both (it's false for NaN and
  // Infinity), so anything but a genuine positive integer falls back to 1.
  // That keeps the eventual `offset = (page - 1) * PAGE_SIZE` finite and
  // non-negative before it ever reaches the API.
  const rawPage = Number(search.page)
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  return {
    q: typeof search.q === 'string' ? search.q : '',
    type,
    page,
  }
}

export const Route = createFileRoute('/_app/search')({
  validateSearch: validateSearchParams,
  component: SearchPage,
})

const TAB_LABELS: Record<SearchEntityType, string> = {
  case: 'Cases',
  alert: 'Alerts',
  observable: 'Observables',
  task: 'Tasks',
  comment: 'Comments',
}

// Backend enum wire values (`CaseStatus` in app/models/case_.py) are
// PascalCase ("Open"/"Resolved"/"Duplicated"); the frontend's `CaseStatus`
// domain type and `StatusBadge` want the lowercase id plus a display label —
// mirrors the (unexported) STATUS_MAP in Cases/casesQueries.ts.
const CASE_STATUS: Record<string, { id: CaseStatus; label: string }> = {
  Open: { id: 'open', label: 'Open' },
  Resolved: { id: 'resolved', label: 'Resolved' },
  Duplicated: { id: 'duplicated', label: 'Duplicated' },
}

// Task wire values ("Waiting"/"InProgress"/…) -> the lowercase TaskStatus
// keys that TASK_STATUS_LABEL/TASK_STATUS_COLOR already index by.
const TASK_STATUS_WIRE: Record<string, TaskStatus> = {
  Waiting: 'waiting',
  InProgress: 'inprogress',
  Completed: 'completed',
  Cancelled: 'cancelled',
}

// Alerts have no StatusBadge-equivalent anywhere else in the app (the alerts
// table doesn't render a status column at all), so this is a standalone
// label map local to the results page.
const ALERT_STATUS_LABEL: Record<string, string> = {
  New: 'New',
  InProgress: 'In Progress',
  Imported: 'Imported',
  Ignored: 'Ignored',
}

function SearchPage() {
  const { q, type, page } = Route.useSearch()
  const navigate = useNavigate()
  const [input, setInput] = useState(q)
  const [debounced] = useDebouncedValue(input, 300)

  // Tracks the `q` value *we* last pushed to the URL. Lets the two effects
  // below tell "q changed because the user typed" apart from "q changed
  // because of Back/Forward, a tab click, or a pasted link" — without this,
  // pressing Back after typing would revert `q` in the URL while `input`/
  // `debounced` still held the newer typed value, and the debounce effect
  // would immediately re-push it, trapping the Back button.
  const lastPushedQ = useRef(q)

  useEffect(() => {
    if (debounced !== lastPushedQ.current) {
      lastPushedQ.current = debounced
      navigate({
        to: '.',
        replace: true,
        search: (prev) => ({ ...prev, q: debounced, page: 1 }),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing settling
  }, [debounced])

  useEffect(() => {
    // `q` changed from outside our own debounce push (Back/Forward, tab
    // switch preserving q, a bookmarked link) — resync the visible input so
    // it doesn't fight the URL.
    if (q !== lastPushedQ.current) {
      lastPushedQ.current = q
      setInput(q)
    }
  }, [q])

  const { data, isPlaceholderData, isError, refetch } = useQuery(
    searchQueryOptions(q, { types: [type], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  )
  // Counts for ALL tabs (cheap only in the sense that limit:1 keeps the row
  // payload tiny — the backend still runs a full COUNT(*) per entity type
  // under the same WHERE clause as the paginated query, so this is a second
  // full search, not a free one).
  const { data: countsData } = useQuery(searchQueryOptions(q, { limit: 1, groupObservables: true }))
  const counts = countsData?.counts

  const total = counts?.[type] ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Emptiness is driven by the *main* query's own rows, not by `counts`
  // (a separate, independently-loading query) — otherwise a first-time
  // search where `data` resolves before `countsData` would flash "No
  // results" (total defaults to 0 while counts is still undefined)
  // underneath the real rows that `data` already has.
  //
  // `isPlaceholderData` additionally excludes the window right after a tab
  // switch, where keepPreviousData still holds the *previous* type's response
  // — whose `results[type]` is empty because the request asked for one type.
  const activeRows = data?.results[type] ?? []
  const showEmpty = Boolean(data) && !isPlaceholderData && activeRows.length === 0

  const setTab = (t: string | null) =>
    navigate({
      to: '.',
      search: (prev) => ({ ...prev, type: t == null ? 'case' : (t as SearchEntityType), page: 1 }),
    })

  const goToPage = (p: number) => navigate({ to: '.', search: (prev) => ({ ...prev, page: p }) })

  const rowLink = (target: ReturnType<typeof hitRoute>, children: React.ReactNode, key: string) => (
    <Link
      key={key}
      {...target}
      style={{
        display: 'block',
        width: '100%',
        padding: 'var(--mantine-spacing-sm)',
        borderRadius: 8,
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )

  return (
    <Box p="lg" maw={960} mx="auto">
      <Title order={3} mb="md">
        Search
      </Title>
      <TextInput
        leftSection={<Search size={16} />}
        placeholder="Search cases, alerts, observables, tasks, comments…"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        mb="md"
      />
      <Tabs value={type} onChange={setTab}>
        <Tabs.List>
          {SEARCH_TYPES.map((t) => (
            <Tabs.Tab key={t} value={t}>
              {TAB_LABELS[t]}
              {counts ? ` ${counts[t]}` : ''}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Stack gap={4} mt="md">
        {type === 'case' &&
          data?.results.case.map((h) => {
            const status: { id: CaseStatus; label: string } =
              CASE_STATUS[h.status] ?? { id: 'open', label: h.status }
            return rowLink(
              hitRoute('case', h),
              <Group wrap="nowrap" gap="sm">
                <Severity id={`#${h.id}`} sev={h.severity as SeverityLevel} />
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={500} truncate>
                    {h.title}
                  </Text>
                  <Text size="sm" c="dimmed" truncate>
                    <Snippet text={h.snippet} />
                  </Text>
                </Box>
                <StatusBadge status={status.id} label={status.label} />
              </Group>,
              `case-${h.id}`,
            )
          })}
        {type === 'alert' &&
          data?.results.alert.map((h) =>
            rowLink(
              hitRoute('alert', h),
              <Group wrap="nowrap" gap="sm">
                <Severity id={`AL-${h.id}`} sev={h.severity as SeverityLevel} />
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={500} truncate>
                    {h.title}
                  </Text>
                  <Text size="sm" c="dimmed" truncate>
                    <Snippet text={h.snippet} />
                  </Text>
                </Box>
                <Badge variant="light" size="sm">
                  {ALERT_STATUS_LABEL[h.status] ?? h.status}
                </Badge>
              </Group>,
              `alert-${h.id}`,
            ),
          )}
        {type === 'observable' &&
          data?.results.observable.map((h) =>
            rowLink(
              hitRoute('observable', h),
              <Group wrap="nowrap" gap="sm">
                <Badge size="sm" variant="light">
                  {h.observable_type}
                </Badge>
                <Text ff="monospace" truncate>
                  {h.data}
                </Text>
                {h.ioc && (
                  <Badge size="xs" color="red">
                    IOC
                  </Badge>
                )}
                <Text size="sm" c="dimmed" truncate>
                  {h.case_id != null ? `#${h.case_id}` : `AL-${h.alert_id}`}
                  {h.message ? ` — ${h.message}` : ''}
                </Text>
              </Group>,
              `obs-${h.id}`,
            ),
          )}
        {type === 'task' &&
          data?.results.task.map((h) => {
            const taskStatus = TASK_STATUS_WIRE[h.status] ?? 'waiting'
            return rowLink(
              hitRoute('task', h),
              <Group wrap="nowrap" gap="sm">
                <Text fw={500} truncate style={{ flex: 1 }}>
                  {h.public_id} {h.title}
                </Text>
                <Badge variant="light" size="sm" color={TASK_STATUS_COLOR[taskStatus]}>
                  {TASK_STATUS_LABEL[taskStatus]}
                </Badge>
              </Group>,
              `task-${h.public_id}`,
            )
          })}
        {type === 'comment' &&
          data?.results.comment.map((h) =>
            rowLink(
              hitRoute('comment', h),
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={500}>
                  on {h.entity_type === 'case' ? '#' : 'AL-'}
                  {h.entity_id}
                  <Text span size="xs" c="dimmed">
                    {' '}
                    — {h.author_name}
                  </Text>
                </Text>
                <Text size="sm" c="dimmed" truncate>
                  <Snippet text={h.snippet} />
                </Text>
              </Box>,
              `comment-${h.id}`,
            ),
          )}
        {isError && (
          <Text c="dimmed" ta="center" p="xl">
            Search failed.{' '}
            <UnstyledButton onClick={() => refetch()} style={{ textDecoration: 'underline' }}>
              <Text span>Retry</Text>
            </UnstyledButton>
          </Text>
        )}
        {showEmpty && (
          <Text c="dimmed" ta="center" p="xl">
            No {TAB_LABELS[type].toLowerCase()} match &ldquo;{q}&rdquo;
          </Text>
        )}
      </Stack>

      {pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination value={page} total={pages} onChange={goToPage} />
        </Group>
      )}
    </Box>
  )
}
