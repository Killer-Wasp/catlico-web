import type {
  CaseDetail,
  CaseDetailObservable,
} from '#/components/Cases/caseDetails.types'
import type {
  Observable,
  ObservableFlag,
  ObservableType,
} from '#/components/Observables/observables.types'
import { caseKeys, createCaseObservable } from '#/components/Cases/casesQueries'
import { updateObservableFlags } from '#/components/Observables/observablesQueries'
import { observableTypesQueryOptions } from '#/components/pages/settings/settingsQueries'
import { ObservableDetailDrawer } from '#/components/pages/ObservablesPage'
import { addFlag, toggleFlag } from '#/components/pages/observables/tableFns'
import { TLP } from '#/lib/domain'
import type { Tlp } from '#/lib/domain'
import {
  Badge,
  Button,
  Checkbox,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import styles from './styles.module.css'

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
    added: observable.added,
  }
}

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
  const [newType, setNewType] = useState<string | null>(null)
  const [newData, setNewData] = useState('')
  const [newTlp, setNewTlp] = useState<string>('2')
  const [newIoc, setNewIoc] = useState(false)
  const [newSighted, setNewSighted] = useState(false)
  const queryClient = useQueryClient()

  const { data: obsTypes } = useQuery(observableTypesQueryOptions())
  const nonAttachmentTypes = (obsTypes ?? [])
    .filter((t) => !t.is_attachment)
    .map((t) => t.name)

  const addObservable = useMutation({
    mutationFn: () =>
      createCaseObservable(caseId, {
        observable_type: newType!,
        data: newData,
        tlp: Number(newTlp),
        ioc: newIoc,
        sighted: newSighted,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setAddingObservable(false)
      setNewType(null)
      setNewData('')
      setNewTlp('2')
      setNewIoc(false)
      setNewSighted(false)
    },
  })

  const flagMutation = useMutation({
    mutationFn: ({
      id,
      flags,
    }: {
      id: string
      flags: ObservableFlag[]
    }) =>
      updateObservableFlags(id, {
        ioc: flags.includes('ioc'),
        sighted: flags.includes('sighted'),
      }),
    onSuccess: (_updated, variables) => {
      setFlagOverrides((current) => ({ ...current, [variables.id]: variables.flags }))
      setActiveObservable((current) =>
        current?.id === variables.id
          ? {
              ...current,
              ioc: variables.flags.includes('ioc'),
              sighted: variables.flags.includes('sighted'),
            }
          : current,
      )
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
    },
  })

  const observables = caseDetail.observables.map((observable) => {
    const override = flagOverrides[observable.id]
    return override
      ? {
          ...observable,
          ioc: override.includes('ioc'),
          sighted: override.includes('sighted'),
        }
      : observable
  })
  const drawerObservable = activeObservable
    ? toObservable(activeObservable, caseDetail)
    : null

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

      <Modal
        opened={addingObservable}
        onClose={() => setAddingObservable(false)}
        title="Add observable"
      >
        <Stack gap="md">
          <Select
            label="Type"
            data={nonAttachmentTypes.map((name) => ({
              value: name,
              label: name,
            }))}
            value={newType}
            onChange={setNewType}
            required
          />
          <TextInput
            label="Value"
            value={newData}
            onChange={(e) => setNewData(e.currentTarget.value)}
            required
          />
          <Select
            label="TLP"
            data={[0, 1, 2, 3].map((n) => ({
              value: String(n),
              label: `${n} — ${TLP[n as Tlp]}`,
            }))}
            value={newTlp}
            onChange={(v) => setNewTlp(v ?? '2')}
          />
          <Checkbox
            label="IOC (indicator of compromise)"
            checked={newIoc}
            onChange={(e) => setNewIoc(e.currentTarget.checked)}
          />
          <Checkbox
            label="Sighted"
            checked={newSighted}
            onChange={(e) => setNewSighted(e.currentTarget.checked)}
          />
          <Button
            fullWidth
            disabled={!newType || !newData.trim()}
            loading={addObservable.isPending}
            onClick={() => addObservable.mutate()}
          >
            Add observable
          </Button>
        </Stack>
      </Modal>

      <CasePanelHeader
        label="Observables"
        action={
          <Button
            variant="default"
            leftSection={<Plus size={16} />}
            onClick={() => setAddingObservable(true)}
          >
            Add observable
          </Button>
        }
      />

      <Table
        aria-label="Case observables"
        verticalSpacing="sm"
        horizontalSpacing={0}
        highlightOnHover
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.fieldLabel} fw={500}>
              Type
            </Table.Th>
            <Table.Th className={styles.fieldLabel} fw={500}>
              Value
            </Table.Th>
            <Table.Th className={styles.fieldLabel} fw={500} ta="right">
              Added
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {observables.map((observable) => (
            <Table.Tr
              key={observable.value}
              tabIndex={0}
              onClick={() => setActiveObservable(observable)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setActiveObservable(observable)
              }}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Badge variant="default" radius="sm" ff="monospace" fw={500}>
                  {observable.type}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text ff="monospace">{observable.value}</Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text ff="monospace" fz={13} c="dimmed">
                  {observable.added}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
