/**
 * An entity's TTPs, backed by the procedures API (not tag heuristics). Shared by
 * the case side-rail and the alert drawer via `entityType` — "Add" opens the
 * ATT&CK matrix in picker mode; saving replaces the entity's procedure set via
 * PUT /{cases|alerts}/{id}/procedures.
 */
import {
  attackCatalogQueryOptions,
  invalidateProcedureQueries,
  proceduresQueryOptions,
  replaceProcedures,
  type ProcedureEntityType,
  type ProcedureInput,
} from '#/components/Attack/attackQueries'
import { AttackMatrix } from '#/components/Attack/AttackMatrix'
import { buildMatrix } from '#/components/Attack/buildMatrix'
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { actionNotice } from './constants'

export function TtpsPanel({
  entityId,
  entityType = 'case',
}: {
  entityId: string
  /** Whether the TTPs hang off a case (default) or an alert (§4.1a). */
  entityType?: ProcedureEntityType
}) {
  const qc = useQueryClient()
  const procedures = useQuery(proceduresQueryOptions(entityType, entityId))
  const [pickerOpen, setPickerOpen] = useState(false)

  const save = useMutation({
    mutationFn: (procs: ProcedureInput[]) =>
      replaceProcedures(entityType, entityId, procs),
    onSuccess: () => {
      invalidateProcedureQueries(qc, entityType, entityId)
      setPickerOpen(false)
    },
    onError: () => actionNotice('Failed to update techniques'),
  })

  const linked = procedures.data ?? []
  // The full {external_id, name} payload for every currently-linked procedure.
  // The backend request model requires `name` on every item, so we rebuild the
  // whole set from this (never send bare {external_id}) when unlinking one.
  // This also carries names for auto-imported patterns absent from the catalog,
  // so a save from the picker can preserve them instead of degrading to the id.
  const linkedInputs: ProcedureInput[] = linked
    .filter((p) => p.pattern != null)
    .map((p) => ({ external_id: p.pattern!.external_id, name: p.pattern!.name }))

  return (
    <Stack gap="xs">
      {linked.length === 0 ? (
        <Text c="dimmed" fz={13}>
          No techniques linked yet.
        </Text>
      ) : (
        linked
          .filter((proc) => proc.pattern != null)
          .map((proc) => (
            <Group key={proc.id} gap={6} wrap="nowrap" justify="space-between">
              <Text fz={13} truncate>
                <Text span ff="monospace" c="dimmed" mr={6}>
                  {proc.pattern!.external_id}
                </Text>
                {proc.pattern!.name}
              </Text>
              <Tooltip label="Unlink technique">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Remove ${proc.pattern!.external_id}`}
                  loading={save.isPending}
                  onClick={() =>
                    save.mutate(
                      linkedInputs.filter(
                        (i) => i.external_id !== proc.pattern!.external_id,
                      ),
                    )
                  }
                >
                  <X size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))
      )}
      <Button
        variant="default"
        size="xs"
        leftSection={<Plus size={14} />}
        onClick={() => setPickerOpen(true)}
      >
        Add techniques
      </Button>
      <AttackPickerDialog
        opened={pickerOpen}
        linkedInputs={linkedInputs}
        saving={save.isPending}
        onSave={(procs) => save.mutate(procs)}
        onClose={() => setPickerOpen(false)}
      />
    </Stack>
  )
}

function AttackPickerDialog({
  opened,
  linkedInputs,
  saving,
  onSave,
  onClose,
}: {
  opened: boolean
  linkedInputs: ProcedureInput[]
  saving: boolean
  onSave: (procs: ProcedureInput[]) => void
  onClose: () => void
}) {
  const catalog = useQuery({ ...attackCatalogQueryOptions(), enabled: opened })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const initialSelected = useMemo(
    () => linkedInputs.map((i) => i.external_id),
    [linkedInputs],
  )
  const effective = selected ?? new Set(initialSelected)

  // Reset local state whenever the dialog opens, so a save->reopen cycle always
  // recomputes `effective` from the (now-updated) linked set. Mantine's onClose
  // doesn't fire on a programmatic `opened` flip, so this can't live in close().
  useEffect(() => {
    if (opened) {
      setSelected(null)
      setSearch('')
    }
  }, [opened])

  const columns = useMemo(() => buildMatrix(catalog.data ?? [], {}), [catalog.data])
  // external_id -> name from the catalog, to build {external_id, name} payloads.
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of catalog.data ?? []) m.set(p.external_id, p.name)
    return m
  }, [catalog.data])
  // Fallback names for already-linked patterns the catalog doesn't know (e.g.
  // auto-imported): without this, saving would overwrite their name with the id.
  const linkedNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of linkedInputs) if (i.name) m.set(i.external_id, i.name)
    return m
  }, [linkedInputs])

  const toggle = (id: string) => {
    const next = new Set(effective)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const close = () => {
    setSelected(null)
    setSearch('')
    onClose()
  }

  const handleSave = () =>
    onSave(
      [...effective].map((id) => ({
        external_id: id,
        name: nameById.get(id) ?? linkedNameById.get(id) ?? id,
      })),
    )

  return (
    <Modal opened={opened} onClose={close} title="Link ATT&CK techniques" size="90%">
      <Stack gap="sm">
        <TextInput
          leftSection={<Search size={14} />}
          placeholder="Filter techniques…"
          aria-label="Filter techniques"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        {catalog.isLoading ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text c="dimmed" fz={13}>
              Loading catalog…
            </Text>
          </Group>
        ) : catalog.isError ? (
          <Text c="red" fz={13}>
            Couldn't load the ATT&CK catalog. Try again in a moment.
          </Text>
        ) : columns.length === 0 ? (
          <Text c="dimmed" fz={13}>
            Catalog is empty — an org admin can import it from Settings → ATT&CK
            catalog.
          </Text>
        ) : (
          <AttackMatrix
            columns={columns}
            mode="picker"
            selectedIds={effective}
            onToggle={toggle}
            search={search}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSave}>
            Save ({effective.size})
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
