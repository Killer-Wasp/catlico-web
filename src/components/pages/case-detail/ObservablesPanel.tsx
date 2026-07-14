import type {
  CaseDetail,
  CaseDetailObservable,
} from '#/components/Cases/caseDetails.types'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from '#/components/Observables/observables.types'
import {
  caseObservablesQueryOptions,
  invalidateObservableQueries,
} from '#/components/Cases/casesQueries'
import { updateObservableFlags } from '#/components/Observables/observablesQueries'
import { CreateObservableDialog } from '#/components/Observables/CreateObservableDialog'
import { ObservableDetailDrawer } from '#/components/pages/ObservablesPage'
import { addFlag, toggleFlag } from '#/components/pages/observables/tableFns'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { Badge, Button, Group, Stack, Text } from '@mantine/core'
import { ObservableFileIndicator } from '#/components/pages/observables/ObservableFileIndicator'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

const CASE_OBSERVABLE_TYPE_MAP: Record<string, ObservableType> = {
  domain: 'domain',
  url: 'url',
  mail: 'mail',
  email: 'mail',
  ip: 'ip',
  ipv4: 'ip',
  ipv6: 'ip',
  hash: 'hash',
  file: 'file',
  filename: 'file',
  other: 'other',
}

function toObservable(
  observable: CaseDetailObservable,
  caseDetail: CaseDetail,
): Observable {
  const flags: ObservableFlag[] = []
  if (observable.ioc) flags.push('ioc')
  if (observable.sighted) flags.push('sighted')

  return {
    id: observable.id,
    type: CASE_OBSERVABLE_TYPE_MAP[observable.type.toLowerCase()] ?? 'other',
    value: observable.value,
    flags,
    tlp: caseDetail.tlp,
    source: caseDetail.id,
    ...(observable.analysis.trim() && observable.analysis !== '—'
      ? { analysis: { analyzer: 'Note', verdict: observable.analysis } }
      : {}),
    attachment: observable.attachment,
    added: observable.added,
    addedAt: observable.addedAt,
  }
}

const COLUMNS: ColumnDef<CaseDetailObservable>[] = [
  {
    id: 'type',
    header: 'Type',
    meta: { nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) => (
      <Badge variant="default" radius="sm" ff="monospace" fw={500}>
        {row.original.type}
      </Badge>
    ),
  },
  {
    id: 'value',
    header: 'Value',
    meta: { grow: true } satisfies TableColumnMeta,
    cell: ({ row }) => (
      <Group gap={6} wrap="nowrap">
        <Text ff="monospace">{row.original.value}</Text>
        {row.original.attachment ? (
          <ObservableFileIndicator attachment={row.original.attachment} />
        ) : null}
      </Group>
    ),
  },
  {
    id: 'added',
    header: 'Added',
    meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) => (
      <Text ff="monospace" fz={13} c="dimmed">
        {row.original.added}
      </Text>
    ),
  },
]

export function ObservablesPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const [activeObservable, setActiveObservable] =
    useState<CaseDetailObservable | null>(null)
  const [flagOverrides, setFlagOverrides] = useState<
    Partial<Record<string, ObservableFlag[]>>
  >({})
  const [addingObservable, setAddingObservable] = useState(false)
  const queryClient = useQueryClient()

  const { data: caseObservables = [] } = useQuery(
    caseObservablesQueryOptions(caseId),
  )

  const flagMutation = useMutation({
    mutationFn: ({ id, flags }: { id: string; flags: ObservableFlag[] }) =>
      updateObservableFlags(id, {
        ioc: flags.includes('ioc'),
        sighted: flags.includes('sighted'),
      }),
    onSuccess: (_updated, variables) => {
      setFlagOverrides((current) => ({
        ...current,
        [variables.id]: variables.flags,
      }))
      setActiveObservable((current) =>
        current?.id === variables.id
          ? {
              ...current,
              ioc: variables.flags.includes('ioc'),
              sighted: variables.flags.includes('sighted'),
            }
          : current,
      )
      invalidateObservableQueries(queryClient, caseId)
    },
  })

  const observables = useMemo(
    () =>
      caseObservables.map((observable) => {
        const override = flagOverrides[observable.id]
        return override
          ? {
              ...observable,
              ioc: override.includes('ioc'),
              sighted: override.includes('sighted'),
            }
          : observable
      }),
    [caseObservables, flagOverrides],
  )
  const drawerObservable = activeObservable
    ? toObservable(activeObservable, caseDetail)
    : null

  const table = useReactTable({
    data: observables,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  })

  const requestObservableFlags = (
    observable: Observable,
    update: (flags: ObservableFlag[]) => ObservableFlag[],
  ) => {
    const nextFlags = update(observable.flags)
    flagMutation.mutate({ id: observable.id, flags: nextFlags })
  }

  return (
    <Stack gap="md" p="lg">
      <ObservableDetailDrawer
        observable={drawerObservable}
        onToggleIoc={(observable) =>
          requestObservableFlags(observable, (flags) =>
            toggleFlag(flags, 'ioc'),
          )
        }
        onMarkSighted={(observable) =>
          requestObservableFlags(observable, (flags) =>
            addFlag(flags, 'sighted'),
          )
        }
        onClose={() => setActiveObservable(null)}
      />

      <CreateObservableDialog
        opened={addingObservable}
        onClose={() => setAddingObservable(false)}
        caseId={Number(caseId)}
        onCreated={() => invalidateObservableQueries(queryClient, caseId)}
      />

      <TablePanel
        title="Observables"
        countNoun="observables"
        table={table}
        withFilterBar={false}
        withPagination={false}
        actions={
          <Button
            variant="default"
            size="xs"
            leftSection={<Plus size={14} />}
            onClick={() => setAddingObservable(true)}
          >
            Add observable
          </Button>
        }
      >
        <DataTable
          table={table}
          minWidth={520}
          ariaLabel="Case observables"
          emptyMessage="No observables for this case."
          onRowClick={(row) => setActiveObservable(row.original)}
        />
      </TablePanel>
    </Stack>
  )
}
