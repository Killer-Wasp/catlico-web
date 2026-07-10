/**
 * PluginResults.tsx — entity-side results panel for case/alert/observable detail.
 *
 * Shows results grouped by plugin/source, supports multiple render modes,
 * stale flag, and provenance links back to the run.
 */

import {
  Badge,
  Box,
  Card,
  Collapse,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'

import type { PluginRunStatus } from '#/components/Plugins/plugins.types'

// ── Types ───────────────────────────────────────────────────────────────────

export type PluginResult = {
  runId: string
  pluginId: string
  pluginName: string
  status: PluginRunStatus
  summary: Record<string, unknown> | null
  createdAt: string | null
}

export type PluginResultsPanelProps = {
  /** Results to display, keyed by plugin id for grouping. */
  results: PluginResult[]
  /** Whether results are still loading. */
  loading?: boolean
  /** Max number of results to show before "show all". */
  maxVisible?: number
}

// ── Render modes ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success: 'green',
  failure: 'red',
  timeout: 'orange',
  skipped: 'gray',
  queued: 'blue',
  running: 'blue',
  cancelled: 'gray',
  cancelling: 'orange',
}

function statusLabel(s: PluginRunStatus): string {
  if (s === 'success') return 'Passed'
  if (s === 'failure') return 'Failed'
  if (s === 'timeout') return 'Timed out'
  if (s === 'skipped') return 'Skipped'
  return s
}

function SummaryRow({ result }: { result: PluginResult }) {
  const [open, setOpen] = useState(false)

  return (
    <Card withBorder radius="md" padding="sm">
      <Group
        justify="space-between"
        wrap="nowrap"
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer' }}
      >
        <Group gap="sm" wrap="nowrap">
          <Badge
            variant="light"
            color={STATUS_COLOR[result.status] ?? 'gray'}
            radius="sm"
            size="sm"
          >
            {statusLabel(result.status)}
          </Badge>
          <Stack gap={0}>
            <Text fz={13} fw={600}>
              {result.pluginName}
            </Text>
            <Text fz={11} c="dimmed" ff="monospace">
              {result.runId?.slice(0, 8)}
            </Text>
          </Stack>
        </Group>
        <Group gap={8} wrap="nowrap">
          {result.createdAt && (
            <Text fz={11} c="dimmed">
              {dayjs(result.createdAt).fromNow()}
            </Text>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Group>
      </Group>

      <Collapse expanded={open}>
        <Box mt="sm">
          {result.summary ? (
            <Box
              component="pre"
              fz={11}
              ff="monospace"
              p="sm"
              style={{
                background: 'var(--mantine-color-dark-8)',
                color: 'var(--mantine-color-gray-2)',
                borderRadius: 'var(--mantine-radius-sm)',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {JSON.stringify(result.summary, null, 2)}
            </Box>
          ) : (
            <Text fz={12} c="dimmed">
              No detailed results available.
            </Text>
          )}
        </Box>
      </Collapse>
    </Card>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export function PluginResultsPanel({
  results,
  loading = false,
  maxVisible = 5,
}: PluginResultsPanelProps) {
  const [showAll, setShowAll] = useState(false)

  // Group by plugin id
  const grouped = useMemo(() => {
    const map = new Map<string, PluginResult[]>()
    for (const r of results) {
      const existing = map.get(r.pluginId) ?? []
      existing.push(r)
      map.set(r.pluginId, existing)
    }
    return map
  }, [results])

  const visible = showAll
    ? results
    : results.slice(0, maxVisible)
  const hidden = results.length - visible.length
  const visibleIds = new Set(visible.map((r) => r.runId))

  if (loading) {
    return (
      <Paper p="md" withBorder radius="md">
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text fz={13} c="dimmed">
            Loading plugin results…
          </Text>
        </Group>
      </Paper>
    )
  }

  if (results.length === 0) {
    return (
      <Paper p="md" withBorder radius="md">
        <Text fz={13} c="dimmed" ta="center" py="md">
          No plugin results yet.
        </Text>
      </Paper>
    )
  }

  return (
    <Paper p="md" withBorder radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={5} size="h6">
          Plugin Results ({results.length})
        </Title>
      </Group>

      <Stack gap="sm">
        {/* Group headers */}
        {Array.from(grouped.entries()).map(([pluginId, items]) => (
          <Stack key={pluginId} gap={4}>
            <Text fz={11} c="dimmed" fw={600} tt="uppercase">
              {items[0]?.pluginName ?? pluginId}
            </Text>
            {items
              .filter((result) => visibleIds.has(result.runId))
              .map((result) => (
              <SummaryRow key={result.runId} result={result} />
            ))}
          </Stack>
        ))}

        {hidden > 0 && (
          <Text
            fz={12}
            c="blue"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setShowAll(true)}
          >
            +{hidden} more results
          </Text>
        )}
      </Stack>
    </Paper>
  )
}
