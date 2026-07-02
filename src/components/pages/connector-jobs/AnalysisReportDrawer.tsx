import type { ConnectorJobDetail } from '#/components/Connectors/connectorJobs.types'
import {
  Badge,
  Box,
  Code,
  Divider,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
} from '@mantine/core'
import type { ReactNode } from 'react'
import { STATUS_COLOR, VERDICT_COLOR } from './constants'
import styles from './styles.module.css'

function ReportProperty({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <Group gap={24} align="baseline" wrap="nowrap">
      <Text ff="monospace" fz={13} c="dimmed" w={120} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text
        ff="monospace"
        fz={13}
        fw={600}
        c="dark.9"
        style={{ wordBreak: 'break-word' }}
      >
        {children}
      </Text>
    </Group>
  )
}

function renderReportValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

export function AnalysisReportDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: ConnectorJobDetail | null
  loading: boolean
  onClose: () => void
}) {
  const reportEntries = detail?.report ? Object.entries(detail.report) : []

  return (
    <Drawer
      opened={loading || detail !== null}
      onClose={onClose}
      position="right"
      size={760}
      title="Analysis job report"
      padding={0}
      styles={{
        header: { borderBottom: '1px solid var(--mantine-color-gray-2)' },
        title: {
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--mantine-color-gray-6)',
        },
        body: { padding: 0 },
      }}
    >
      {loading && !detail ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      ) : detail ? (
        <Box>
          <Box
            px="xl"
            py="lg"
            style={{
              borderLeft: detail.verdict
                ? `5px solid var(--mantine-color-${VERDICT_COLOR[detail.verdict]}-6)`
                : '5px solid var(--mantine-color-gray-4)',
            }}
          >
            <Text className={styles.columnHeader}>
              Observable · {detail.observableType}
            </Text>
            <Text
              ff="monospace"
              fz={18}
              fw={800}
              mt={8}
              style={{ wordBreak: 'break-word' }}
            >
              {detail.observable}
            </Text>
            <Group gap={8} mt="sm">
              <Badge
                variant="light"
                color={STATUS_COLOR[detail.status]}
                radius="sm"
                ff="monospace"
              >
                {detail.status}
              </Badge>
              {detail.verdict && (
                <Badge
                  variant="light"
                  color={VERDICT_COLOR[detail.verdict]}
                  radius="sm"
                  ff="monospace"
                >
                  {detail.verdict}
                </Badge>
              )}
              {detail.cached && (
                <Badge variant="default" radius="sm" ff="monospace">
                  cached
                </Badge>
              )}
            </Group>
          </Box>

          <Divider />

          <Stack gap={10} px="xl" py="lg">
            <Text className={styles.columnHeader}>Job</Text>
            <ReportProperty label="Analyzer">
              {detail.plugin} {detail.version && `· ${detail.version}`}
            </ReportProperty>
            <ReportProperty label="Type">
              {detail.observableType}
            </ReportProperty>
            <ReportProperty label="TLP">{detail.tlp}</ReportProperty>
            <ReportProperty label="Attempts">{detail.attempts}</ReportProperty>
            <ReportProperty label="Queued">
              {detail.queued ?? '—'}
            </ReportProperty>
            <ReportProperty label="Started">
              {detail.started ?? '—'}
            </ReportProperty>
            <ReportProperty label="Ended">{detail.ended ?? '—'}</ReportProperty>
            <ReportProperty label="Duration">
              {detail.duration ?? '—'}
            </ReportProperty>
          </Stack>

          {detail.error && (
            <>
              <Divider />
              <Stack gap={8} px="xl" py="lg">
                <Text className={styles.columnHeader}>Error</Text>
                <Text
                  ff="monospace"
                  fz={13}
                  c="red.7"
                  style={{ wordBreak: 'break-word' }}
                >
                  {detail.error}
                </Text>
              </Stack>
            </>
          )}

          {detail.tags.length > 0 && (
            <>
              <Divider />
              <Stack gap={10} px="xl" py="lg">
                <Text className={styles.columnHeader}>Verdict badges</Text>
                <Group gap={8}>
                  {detail.tags.map((tag) => (
                    <Badge
                      key={`${tag.namespace}-${tag.predicate}-${tag.value}`}
                      variant="outline"
                      color={VERDICT_COLOR[tag.level]}
                      radius="sm"
                      ff="monospace"
                      fz={11}
                    >
                      {tag.namespace}:{tag.predicate}={tag.value}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </>
          )}

          <Divider />

          <Stack gap={10} px="xl" py="lg">
            <Text className={styles.columnHeader}>Analyzer report</Text>
            {reportEntries.length > 0 ? (
              <Stack gap={8}>
                {reportEntries.map(([key, value]) => (
                  <Group key={key} gap={24} align="flex-start" wrap="nowrap">
                    <Text
                      ff="monospace"
                      fz={13}
                      c="dimmed"
                      w={150}
                      style={{ flexShrink: 0 }}
                    >
                      {key}
                    </Text>
                    <Code block style={{ flex: 1, fontSize: 12 }}>
                      {renderReportValue(value)}
                    </Code>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" fz={13}>
                This job returned no report payload.
              </Text>
            )}
          </Stack>
        </Box>
      ) : null}
    </Drawer>
  )
}
