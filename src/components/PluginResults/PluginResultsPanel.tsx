/**
 * PluginResultsPanel.tsx — entity-side Plugin Results / Enrichment panel.
 *
 * Renders append-only `PluginResult` evidence for one entity (observable, case,
 * or alert), as specified in the plan's "Plugin Result And Evidence Model" and
 * "Entity-side surfaces". Results are grouped by plugin then source, latest
 * first with older runs behind a history toggle; verdict and confidence are
 * surfaced prominently; stale (expired) results are flagged but never hidden;
 * `raw_data` is collapsed behind an expand. A proposed-actions strip is
 * embedded at the top (self-hiding, permission-gated server-side).
 *
 * This replaces the earlier orphaned panel that modelled plugin *runs*
 * (`{runId, status, ...}`); that shape could not render verdicts, confidence,
 * render modes, or attachments and was imported nowhere.
 */
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Card,
  Code,
  Collapse,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { relativeTimeLabel } from '#/components/Time/RelativeTime'
import { errorMessage } from '#/lib/ui-helpers'
import { ProposedActionsStrip } from '#/components/pages/plugins/proposed/ProposedActionsStrip'
import {
  groupResults,
  markdownBody,
  pluginResultsQueryOptions,
  resolveRenderMode,
} from './pluginResults'
import { MarkdownView } from './MarkdownView'
import type {
  PluginResult,
  PluginResultEntityType,
  Verdict,
} from './pluginResults.types'

// ── Verdict / confidence presentation ────────────────────────────────────────

const VERDICT_COLOR: Record<Verdict, string> = {
  unknown: 'gray',
  info: 'blue',
  benign: 'green',
  suspicious: 'yellow',
  malicious: 'red',
  error: 'orange',
}

/** Confidence is a numeric score; treat ≤1 as a 0–1 ratio, else a raw score. */
function formatConfidence(confidence: number): string {
  if (confidence <= 1) return `${Math.round(confidence * 100)}%`
  return String(confidence)
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// ── Render-mode bodies ───────────────────────────────────────────────────────

function JsonBody({ data }: { data: unknown }) {
  return (
    <Code
      block
      style={{ maxHeight: 260, overflow: 'auto', fontSize: 11 }}
    >
      {JSON.stringify(data ?? null, null, 2)}
    </Code>
  )
}

function KeyValueBody({ data }: { data: Record<string, unknown> | null }) {
  const entries = data ? Object.entries(data) : []
  if (entries.length === 0) return <JsonBody data={data} />
  return (
    <Table withRowBorders={false} verticalSpacing={4} fz={12}>
      <Table.Tbody>
        {entries.map(([key, value]) => (
          <Table.Tr key={key}>
            <Table.Td style={{ width: '35%', verticalAlign: 'top' }}>
              <Text fz={12} c="dimmed" ff="monospace">
                {key}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz={12} style={{ wordBreak: 'break-word' }}>
                {typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/** Find the first array-of-objects in the payload to render as rows. */
function findRows(
  data: Record<string, unknown> | null,
): Record<string, unknown>[] | null {
  if (!data) return null
  for (const key of ['rows', 'items', 'data', 'results', 'records']) {
    const value = data[key]
    if (Array.isArray(value) && value.every((v) => v && typeof v === 'object')) {
      return value as Record<string, unknown>[]
    }
  }
  return null
}

function TableBody({ data }: { data: Record<string, unknown> | null }) {
  const rows = findRows(data)
  if (!rows || rows.length === 0) return <JsonBody data={data} />
  const columns = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set()),
  )
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Table withTableBorder withColumnBorders fz={12}>
        <Table.Thead>
          <Table.Tr>
            {columns.map((col) => (
              <Table.Th key={col}>{col}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, i) => (
            <Table.Tr key={i}>
              {columns.map((col) => (
                <Table.Td key={col}>
                  {row[col] == null
                    ? ''
                    : typeof row[col] === 'object'
                      ? JSON.stringify(row[col])
                      : String(row[col])}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  )
}

function ResultBody({ result }: { result: PluginResult }) {
  const mode = resolveRenderMode(result.renderMode)
  if (mode === 'markdown') {
    const md = markdownBody(result)
    if (!md) {
      return (
        <Text fz={12} c="dimmed" fs="italic">
          No content.
        </Text>
      )
    }
    return <MarkdownView markdown={md} />
  }
  if (mode === 'key_value') return <KeyValueBody data={result.normalizedData} />
  if (mode === 'table') return <TableBody data={result.normalizedData} />
  return <JsonBody data={result.normalizedData} />
}

// ── Attachment chips (non-interactive metadata) ──────────────────────────────
//
// There is no public plugin-file download route (the serializer deliberately
// synthesizes no URL — see `app/crud/plugin_result.py`), so chips are rendered
// as inert metadata: filename + size, no download action.

function AttachmentChips({ result }: { result: PluginResult }) {
  if (result.attachments.length === 0) return null
  return (
    <Group gap={6}>
      {result.attachments.map((att, i) => (
        <Badge
          key={att.sha256 ?? att.fileRef ?? `${att.filename}-${i}`}
          variant="outline"
          color="gray"
          radius="sm"
          size="sm"
          styles={{ label: { textTransform: 'none' } }}
        >
          {att.filename ?? 'attachment'}
          {att.size != null ? ` · ${formatBytes(att.size)}` : ''}
        </Badge>
      ))}
    </Group>
  )
}

// ── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: PluginResult }) {
  const [rawOpen, setRawOpen] = useState(false)
  const hasRaw = result.rawData != null

  return (
    <Card withBorder radius="md" padding="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={2}>
            {result.title && (
              <Text fz={13} fw={600}>
                {result.title}
              </Text>
            )}
            <Group gap={6}>
              <Badge
                variant="filled"
                color={VERDICT_COLOR[result.verdict]}
                radius="sm"
                size="sm"
              >
                {result.verdict}
              </Badge>
              {result.confidence != null && (
                <Badge variant="light" color="gray" radius="sm" size="sm">
                  conf {formatConfidence(result.confidence)}
                </Badge>
              )}
              {result.stale && (
                <Badge variant="light" color="orange" radius="sm" size="sm">
                  stale
                </Badge>
              )}
            </Group>
          </Stack>
          <Text fz={11} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {relativeTimeLabel(result.createdAt, '')}
          </Text>
        </Group>

        {result.summary && (
          <Text fz={12} c="dimmed">
            {result.summary}
          </Text>
        )}

        <ResultBody result={result} />

        <AttachmentChips result={result} />

        {hasRaw && (
          <Box>
            <Anchor
              component="button"
              type="button"
              fz={12}
              c="dimmed"
              onClick={() => setRawOpen((open) => !open)}
            >
              <Group gap={4} wrap="nowrap">
                {rawOpen ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
                Raw data
              </Group>
            </Anchor>
            <Collapse expanded={rawOpen}>
              <Box mt={6}>
                <JsonBody data={result.rawData} />
              </Box>
            </Collapse>
          </Box>
        )}
      </Stack>
    </Card>
  )
}

// ── Source group (latest + history) ──────────────────────────────────────────

function SourceSection({
  source,
  latest,
  history,
}: {
  source: string
  latest: PluginResult
  history: PluginResult[]
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  return (
    <Stack gap={6}>
      {source && (
        <Text fz={11} c="dimmed" ff="monospace">
          {source}
        </Text>
      )}
      <ResultCard result={latest} />
      {history.length > 0 && (
        <Box>
          <Anchor
            component="button"
            type="button"
            fz={12}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <Group gap={4} wrap="nowrap">
              {historyOpen ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )}
              {historyOpen
                ? 'Hide history'
                : `Show ${history.length} older result${history.length === 1 ? '' : 's'}`}
            </Group>
          </Anchor>
          <Collapse expanded={historyOpen}>
            <Stack gap={6} mt={6}>
              {history.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Stack>
  )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export type PluginResultsPanelProps = {
  entityType: PluginResultEntityType
  entityId: string
}

export function PluginResultsPanel({
  entityType,
  entityId,
}: PluginResultsPanelProps) {
  const {
    data: results = [],
    isPending,
    isError,
    error,
  } = useQuery(pluginResultsQueryOptions(entityType, entityId))

  const groups = useMemo(() => groupResults(results), [results])

  return (
    <Stack gap="md">
      <ProposedActionsStrip entityType={entityType} entityId={entityId} />

      <Paper p="md" withBorder radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={5} size="h6">
            Plugin Results
          </Title>
          {!isPending && !isError && results.length > 0 && (
            <Badge variant="light" color="gray" radius="sm" size="sm">
              {results.length}
            </Badge>
          )}
        </Group>

        {isPending ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
            <Text fz={13} c="dimmed">
              Loading plugin results…
            </Text>
          </Group>
        ) : isError ? (
          <Alert color="red" variant="light" title="Could not load plugin results">
            {errorMessage(error)}
          </Alert>
        ) : results.length === 0 ? (
          <Text fz={13} c="dimmed" ta="center" py="md">
            No plugin results yet.
          </Text>
        ) : (
          <Stack gap="lg">
            {groups.map((group) => (
              <Stack key={group.pluginId} gap="sm">
                <Text fz={11} fw={700} tt="uppercase" c="dimmed" lts="0.5px">
                  {group.pluginId}
                </Text>
                {group.sources.map((sourceGroup) => (
                  <SourceSection
                    key={`${group.pluginId}:${sourceGroup.source}`}
                    source={sourceGroup.source}
                    latest={sourceGroup.latest}
                    history={sourceGroup.history}
                  />
                ))}
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}
