import { Button, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  slaPoliciesQueryOptions,
  settingsKeys,
  upsertSlaPolicies,
} from '#/components/Settings/settingsQueries'
import type { SlaPolicyUpsertInput } from '#/components/Settings/settingsQueries'
import { LoadingPanel, Panel, TableBox } from '#/components/Settings/settingsUi'

const SEVERITY_LABELS: Record<number, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: 'gray',
  2: 'orange.7',
  3: 'red.7',
  4: 'red.9',
}

type EditableRow = {
  severity: number
  ack: string
  resolve: string
  escalate: string
  enabled: boolean
}

function secondsToCompact(s: number): string {
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

function compactToSeconds(v: string): number {
  const m = /^(\d+)\s*(m|h|d)$/i.exec(v.trim())
  if (!m) return 0
  const n = Number(m[1])
  switch (m[2].toLowerCase()) {
    case 'm': return n * 60
    case 'h': return n * 3600
    case 'd': return n * 86400
    default: return 0
  }
}

export function SlaPanel() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(slaPoliciesQueryOptions())
  const [rows, setRows] = useState<EditableRow[]>([])

  const policies = data?.items ?? []

  useEffect(() => {
    if (!policies.length) return
    setRows(
      policies.map((p) => ({
        severity: p.severity,
        ack: secondsToCompact(p.ack_seconds),
        resolve: secondsToCompact(p.resolve_seconds),
        escalate: p.escalation_target,
        enabled: p.enabled,
      })),
    )
  }, [policies.length])

  const saveMutation = useMutation({
    mutationFn: (input: SlaPolicyUpsertInput[]) => upsertSlaPolicies(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
      notifications.show({ color: 'green', message: 'SLA policies saved' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to save SLA policies',
      }),
  })

  const handleSave = () => {
    const input: SlaPolicyUpsertInput[] = rows.map((r) => ({
      severity: r.severity,
      ack_seconds: compactToSeconds(r.ack),
      resolve_seconds: compactToSeconds(r.resolve),
      escalation_target: r.escalate,
      enabled: r.enabled,
    }))
    saveMutation.mutate(input)
  }

  const setRow = (severity: number, patch: Partial<EditableRow>) => {
    setRows((current) =>
      current.map((r) => (r.severity === severity ? { ...r, ...patch } : r)),
    )
  }

  if (isPending) return <LoadingPanel label="Loading SLA policies..." />

  if (isError) {
    return (
      <Panel title="SLA policies">
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load SLA policies.</Text>
          <Button variant="default" loading={isFetching} onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Panel>
    )
  }

  return (
    <Panel title="SLA policies" count="per severity">
      <TableBox>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Time to acknowledge</Table.Th>
              <Table.Th>Time to resolve</Table.Th>
              <Table.Th>Escalate to</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.severity}>
                <Table.Td>
                  <Text
                    ff="monospace"
                    fw={700}
                    c={SEVERITY_COLORS[row.severity] ?? 'gray'}
                  >
                    {SEVERITY_LABELS[row.severity] ?? row.severity}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${SEVERITY_LABELS[row.severity]} time to acknowledge`}
                    value={row.ack}
                    w={100}
                    onChange={(e) => setRow(row.severity, { ack: e.currentTarget.value })}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={`${SEVERITY_LABELS[row.severity]} time to resolve`}
                    value={row.resolve}
                    w={100}
                    onChange={(e) => setRow(row.severity, { resolve: e.currentTarget.value })}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    data={['On-call lead', 'CISO', 'Queue']}
                    value={row.escalate}
                    allowDeselect={false}
                    w={180}
                    aria-label={`${SEVERITY_LABELS[row.severity]} escalation`}
                    onChange={(v) => setRow(row.severity, { escalate: v ?? '' })}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </TableBox>
      <Group justify="flex-end" p={18} pt={0}>
        <Button color="orange" loading={saveMutation.isPending} onClick={handleSave}>
          Save SLA policies
        </Button>
      </Group>
    </Panel>
  )
}
