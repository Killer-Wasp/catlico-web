import type { CaseTemplateCustomField } from '#/components/Cases/caseTemplates.types'
import { ActionIcon, Select, Table, TextInput } from '@mantine/core'
import { X } from 'lucide-react'
import { customFieldTypes } from './options'

function CustomFieldRow({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: CaseTemplateCustomField
  index: number
  onUpdate: (patch: Partial<CaseTemplateCustomField>) => void
  onRemove: () => void
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <TextInput
          value={field.label}
          placeholder="Label"
          aria-label={`Custom field ${index + 1} label`}
          onChange={(event) => {
            const label = event.currentTarget.value
            onUpdate({
              label,
              key: label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/(^_|_$)/g, ''),
            })
          }}
        />
      </Table.Td>
      <Table.Td>
        <Select
          data={customFieldTypes}
          value={field.type}
          aria-label={`Custom field ${index + 1} type`}
          onChange={(value) => onUpdate({ type: value ?? 'string' })}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          value={field.defaultValue}
          placeholder="Default value"
          aria-label={`Custom field ${index + 1} default value`}
          onChange={(event) =>
            onUpdate({ defaultValue: event.currentTarget.value })
          }
        />
      </Table.Td>
      <Table.Td ta="right">
        <ActionIcon
          variant="default"
          color="red"
          aria-label={`Remove custom field ${index + 1}`}
          onClick={onRemove}
        >
          <X size={15} />
        </ActionIcon>
      </Table.Td>
    </Table.Tr>
  )
}

export function CustomFieldsTable({
  fields,
  onUpdate,
  onRemove,
}: {
  fields: CaseTemplateCustomField[]
  onUpdate: (index: number, patch: Partial<CaseTemplateCustomField>) => void
  onRemove: (index: number) => void
}) {
  return (
    <Table.ScrollContainer minWidth={680}>
      <Table
        aria-label="Custom fields"
        horizontalSpacing="md"
        verticalSpacing="sm"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Label</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Default value</Table.Th>
            <Table.Th aria-label="Custom field actions" />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((field, index) => (
            <CustomFieldRow
              key={`${index}-${field.key}`}
              field={field}
              index={index}
              onUpdate={(patch) => onUpdate(index, patch)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
