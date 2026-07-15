import {
  caseCustomFieldValuesQueryOptions,
  invalidateCustomFieldQueries,
  setCaseCustomFields,
} from '#/components/Cases/casesQueries'
import {
  alertCustomFieldValuesQueryOptions,
  invalidateAlertCustomFieldQueries,
  setAlertCustomFields,
} from '#/components/Alerts/alertsQueries'
import { CustomFieldInput } from '#/components/CustomFields/CustomFieldInput'
import { CustomFieldValueDisplay } from '#/components/CustomFields/CustomFieldValueDisplay'
import { customFieldsQueryOptions } from '#/components/pages/settings/settingsQueries'
import type { CustomFieldPublic } from '#/components/pages/settings/settingsQueries'
import { usePermissions } from '#/lib/auth/usePermissions'
import {
  Badge,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'

/** Backend `custom_field` field types coerced from a string form value to the
 *  typed value the PUT endpoint expects. */
function toTypedValue(field: CustomFieldPublic, raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (field.field_type === 'integer') return Number.parseInt(trimmed, 10)
  if (field.field_type === 'float') return Number.parseFloat(trimmed)
  if (field.field_type === 'boolean') return trimmed === 'yes' || trimmed === 'true'
  return trimmed
}

/** Turn a stored (typed) value back into the string the input edits. */
function toStringValue(field: CustomFieldPublic, value: unknown): string {
  if (value == null) return ''
  if (field.field_type === 'boolean') return value ? 'yes' : 'no'
  if (field.field_type === 'date') {
    // The date input wants a bare yyyy-mm-dd; the API stores an ISO datetime.
    const iso = String(value)
    return iso.length >= 10 ? iso.slice(0, 10) : iso
  }
  return String(value)
}

export function CustomFieldsPanel({
  caseId,
  entityId,
  entityType = 'case',
}: {
  /** @deprecated pass `entityId` + `entityType`; kept for the case caller. */
  caseId?: string
  entityId?: string
  /** Whether the fields hang off a case (default) or an alert (§4.1c). */
  entityType?: 'case' | 'alert'
}) {
  const id = entityId ?? caseId ?? ''
  const isAlert = entityType === 'alert'
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const canWrite = can(isAlert ? 'write:alert' : 'write:case')

  const { data: defsResult } = useQuery(customFieldsQueryOptions())
  // Both branches yield the same value shape but different literal query keys,
  // so widen to a common options type before handing to useQuery.
  const valuesOptions = (
    isAlert
      ? alertCustomFieldValuesQueryOptions(id)
      : caseCustomFieldValuesQueryOptions(id)
  ) as UseQueryOptions<
    Record<string, unknown>,
    Error,
    Record<string, unknown>
  >
  const { data: values } = useQuery(valuesOptions)
  const definitions = defsResult?.fields ?? []
  const currentValues = values ?? {}

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)

  const mutation = useMutation({
    mutationFn: (next: Record<string, unknown>) =>
      isAlert ? setAlertCustomFields(id, next) : setCaseCustomFields(id, next),
    onSuccess: () => {
      if (isAlert) invalidateAlertCustomFieldQueries(queryClient, id)
      else invalidateCustomFieldQueries(queryClient, id)
      setEditingKey(null)
      setDraft('')
      setAdding(false)
      notifications.show({ color: 'teal', message: 'Custom fields updated' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update custom fields',
      }),
  })

  const startEdit = (field: CustomFieldPublic) => {
    setEditingKey(field.name)
    setDraft(toStringValue(field, currentValues[field.name]))
  }

  const save = (field: CustomFieldPublic) => {
    const typed = toTypedValue(field, draft)
    const next: Record<string, unknown> = { ...currentValues }
    if (typed === null) delete next[field.name]
    else next[field.name] = typed
    mutation.mutate(next)
  }

  const remove = (field: CustomFieldPublic) => {
    const next = { ...currentValues }
    delete next[field.name]
    mutation.mutate(next)
  }

  // Fields that have a value now, plus the one being freshly added.
  const valuedNames = new Set(Object.keys(currentValues))
  if (editingKey) valuedNames.add(editingKey)
  const shownFields = definitions.filter((f) => valuedNames.has(f.name))
  const unsetFields = definitions.filter((f) => !valuedNames.has(f.name))

  return (
    <Stack gap="md" p="lg">
      <CasePanelHeader
        label="Custom fields"
        action={
          canWrite && unsetFields.length > 0 ? (
            <Button
              variant="default"
              size="xs"
              leftSection={<Plus size={14} />}
              onClick={() => setAdding((v) => !v)}
            >
              Add Custom field
            </Button>
          ) : undefined
        }
      />

      {adding && unsetFields.length > 0 && (
        <Select
          placeholder="Pick a field to add"
          data={unsetFields.map((f) => ({
            value: f.name,
            label: f.display_name || f.name,
          }))}
          value={null}
          searchable
          size="sm"
          maw={280}
          aria-label="Pick a field to add"
          onChange={(name) => {
            if (!name) return
            setEditingKey(name)
            setDraft('')
            setAdding(false)
          }}
        />
      )}

      {shownFields.length === 0 && !editingKey ? (
        <Text fz={13} c="dimmed">
          No custom fields for this {isAlert ? 'alert' : 'case'}.
        </Text>
      ) : (
        <Table verticalSpacing="sm" fz={14}>
          <Table.Tbody>
            {shownFields.map((field) => {
              const editing = editingKey === field.name
              return (
                <Table.Tr key={field.name}>
                  <Table.Td w="35%">
                    <Group gap={8} wrap="nowrap">
                      <Text fw={600}>{field.display_name || field.name}</Text>
                      <Badge variant="default" size="xs">
                        {field.field_type}
                      </Badge>
                      {field.mandatory && (
                        <Text component="span" c="var(--sev-critical)">
                          *
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {editing ? (
                      <Group gap={8} align="flex-end" wrap="nowrap">
                        <Box style={{ flex: 1 }}>
                          <CustomFieldInput
                            type={field.field_type}
                            options={field.options}
                            label={field.display_name || field.name}
                            value={draft}
                            mandatory={field.mandatory}
                            onChange={setDraft}
                          />
                        </Box>
                        <Button
                          size="xs"
                          loading={mutation.isPending}
                          onClick={() => save(field)}
                        >
                          Save
                        </Button>
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => {
                            setEditingKey(null)
                            setDraft('')
                          }}
                        >
                          Cancel
                        </Button>
                      </Group>
                    ) : (
                      <Group justify="space-between" wrap="nowrap">
                        <CustomFieldValueDisplay
                          type={field.field_type}
                          value={currentValues[field.name]}
                        />
                        {canWrite && (
                          <Group gap={6} wrap="nowrap">
                            <Button
                              size="xs"
                              variant="subtle"
                              onClick={() => startEdit(field)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => remove(field)}
                            >
                              Remove
                            </Button>
                          </Group>
                        )}
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
