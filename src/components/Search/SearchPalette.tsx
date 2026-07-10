import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Group,
  Kbd,
  Modal,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import {
  useDebouncedValue,
  useDisclosure,
  useHotkeys,
  useWindowEvent,
} from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Snippet } from '#/components/Search/Snippet'
import {
  SEARCH_TYPES,
  hitRoute,
  searchQueryOptions,
  type SearchEntityType,
  type SearchResponse,
} from '#/lib/search'

const OPEN_EVENT = 'catlico:open-search'

/** Imperative opener for triggers outside this component tree (Header). */
export function openSearchPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

type PaletteTab = 'all' | SearchEntityType

const TAB_LABELS: Record<PaletteTab, string> = {
  all: 'All',
  case: 'Cases',
  alert: 'Alerts',
  observable: 'Observables',
  task: 'Tasks',
  comment: 'Comments',
}

type Row = {
  key: string
  type: SearchEntityType
  label: React.ReactNode
  target: ReturnType<typeof hitRoute> | null
  sectionStart?: string
}

function rowsForTab(tab: PaletteTab, data: SearchResponse | undefined): Row[] {
  if (!data) return []
  const rows: Row[] = []
  const perType = tab === 'all' ? 3 : Infinity
  const types: SearchEntityType[] = tab === 'all' ? SEARCH_TYPES : [tab]
  for (const t of types) {
    const push = (row: Omit<Row, 'sectionStart'>, idx: number) =>
      rows.push(tab === 'all' && idx === 0 ? { ...row, sectionStart: TAB_LABELS[t] } : row)
    if (t === 'case') {
      data.results.case.slice(0, perType).forEach((h, i) =>
        push(
          {
            key: `case-${h.id}`,
            type: t,
            label: (
              <Group gap={4} wrap="nowrap">
                <Text size="xs" c="dimmed" ff="monospace">
                  #{h.id}
                </Text>
                <Text size="sm" fw={500} truncate>
                  {h.title}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  <Snippet text={h.snippet} />
                </Text>
              </Group>
            ),
            target: hitRoute('case', h),
          },
          i,
        ),
      )
    } else if (t === 'alert') {
      data.results.alert.slice(0, perType).forEach((h, i) =>
        push(
          {
            key: `alert-${h.id}`,
            type: t,
            label: (
              <Group gap={4} wrap="nowrap">
                <Text size="xs" c="dimmed" ff="monospace">
                  AL-{h.id}
                </Text>
                <Text size="sm" truncate>
                  {h.title}
                </Text>
              </Group>
            ),
            target: hitRoute('alert', h),
          },
          i,
        ),
      )
    } else if (t === 'observable') {
      data.results.observable_groups.slice(0, perType).forEach((g, i) =>
        push(
          {
            key: `obs-${g.observable_type}-${g.data}`,
            type: t,
            label: (
              <Group gap="xs" wrap="nowrap">
                <Badge size="xs" variant="light">
                  {g.observable_type}
                </Badge>
                <Text size="sm" ff="monospace" truncate>
                  {g.data}
                </Text>
                <Text size="xs" c="dimmed">
                  {g.occurrences} occurrences
                </Text>
              </Group>
            ),
            target: null, // grouped: fan out to the results page
          },
          i,
        ),
      )
    } else if (t === 'task') {
      data.results.task.slice(0, perType).forEach((h, i) =>
        push(
          {
            key: `task-${h.public_id}`,
            type: t,
            label: (
              <Group gap={4} wrap="nowrap">
                <Text size="xs" c="dimmed" ff="monospace">
                  {h.public_id}
                </Text>
                <Text size="sm" truncate>
                  {h.title}
                </Text>
              </Group>
            ),
            target: hitRoute('task', h),
          },
          i,
        ),
      )
    } else {
      data.results.comment.slice(0, perType).forEach((h, i) =>
        push(
          {
            key: `comment-${h.id}`,
            type: t,
            label: (
              <Text size="sm" truncate>
                on {h.entity_type === 'case' ? '#' : 'AL-'}
                {h.entity_id}{' '}
                <Text span size="xs" c="dimmed">
                  <Snippet text={h.snippet} />
                </Text>
              </Text>
            ),
            target: hitRoute('comment', h),
          },
          i,
        ),
      )
    }
  }
  return rows
}

export function SearchPalette({
  initiallyOpened = false,
  initialQuery = '',
}: {
  initiallyOpened?: boolean
  initialQuery?: string
}) {
  const [opened, { open, close }] = useDisclosure(initiallyOpened)
  const [query, setQuery] = useState(initialQuery)
  const [tab, setTab] = useState<PaletteTab>('all')
  const [active, setActive] = useState(0)
  const [debounced] = useDebouncedValue(query, 200)
  const navigate = useNavigate()

  useHotkeys([['mod+K', open]])
  useWindowEvent(OPEN_EVENT, open)

  const { data, isError, refetch } = useQuery(
    searchQueryOptions(debounced, { limit: 5, groupObservables: true }),
  )
  const rows = useMemo(() => rowsForTab(tab, data), [tab, data])
  useEffect(() => setActive(0), [rows.length, tab])

  const tabOrder: PaletteTab[] = ['all', ...SEARCH_TYPES]

  const go = (row: Row) => {
    close()
    if (row.target) {
      navigate(row.target)
    } else {
      // TODO(task-12): drop the `as never` once /search route exists
      navigate({
        to: '/search' as never,
        search: { q: query, type: row.type, page: 1 } as never,
      })
    }
  }

  const goToResultsPage = () => {
    close()
    // TODO(task-12): drop the `as never` once /search route exists
    navigate({
      to: '/search' as never,
      search: { q: query, type: tab === 'all' ? 'case' : tab, page: 1 } as never,
    })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1
      setTab((t) => tabOrder[(tabOrder.indexOf(t) + delta + tabOrder.length) % tabOrder.length])
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rows[active]) go(rows[active])
      else if (query.trim().length >= 2) goToResultsPage()
    }
  }

  return (
    <Modal opened={opened} onClose={close} withCloseButton={false} size="lg" padding="sm" yOffset="10vh">
      <TextInput
        data-autofocus
        leftSection={<Search size={16} />}
        rightSection={<Kbd size="xs">esc</Kbd>}
        placeholder="Search cases, alerts, observables, tasks, comments…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      {query.trim().length < 2 ? (
        <Text size="sm" c="dimmed" p="md" ta="center">
          Type to search cases, alerts, observables, tasks and comments
        </Text>
      ) : isError ? (
        <Text size="sm" c="dimmed" p="md" ta="center">
          Search failed.{' '}
          <UnstyledButton onClick={() => refetch()} style={{ textDecoration: 'underline' }}>
            <Text span size="sm">
              Retry
            </Text>
          </UnstyledButton>
        </Text>
      ) : (
        <>
          <Tabs value={tab} onChange={(v) => setTab((v as PaletteTab) ?? 'all')} mt="xs">
            <Tabs.List>
              {tabOrder.map((t) => (
                <Tabs.Tab key={t} value={t} disabled={t !== 'all' && (data?.counts[t] ?? 0) === 0}>
                  {TAB_LABELS[t]}
                  {t !== 'all' && data ? ` ${data.counts[t]}` : ''}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <Box mt="xs">
            {rows.map((row, i) => (
              <Box key={row.key}>
                {row.sectionStart && (
                  <Text size="xs" c="dimmed" tt="uppercase" mt="xs" mb={4}>
                    {row.sectionStart}
                  </Text>
                )}
                <UnstyledButton
                  onClick={() => go(row)}
                  onMouseEnter={() => setActive(i)}
                  w="100%"
                  p={6}
                  style={{
                    borderRadius: 6,
                    background:
                      i === active
                        ? 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))'
                        : undefined,
                  }}
                >
                  {row.label}
                </UnstyledButton>
              </Box>
            ))}
            {rows.length === 0 && (
              <Text size="sm" c="dimmed" p="md" ta="center">
                No matches
              </Text>
            )}
            <UnstyledButton onClick={goToResultsPage} w="100%" p={6} mt={4}>
              <Text size="xs" c="dimmed">
                See all results →
              </Text>
            </UnstyledButton>
          </Box>
        </>
      )}
    </Modal>
  )
}
