import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { Button, Stack, Table, Text } from '@mantine/core'
import { Plus } from 'lucide-react'
import { CasePanelHeader } from './CasePanelHeader'
import styles from './styles.module.css'

export function CustomFieldsPanel({
  customFields,
}: {
  customFields: CaseDetail['customFields']
}) {
  return (
    <Stack gap="lg" p="lg">
      <CasePanelHeader
        label="Custom fields"
        action={
          <Button variant="default" leftSection={<Plus size={16} />}>
            Add Custom field
          </Button>
        }
      />

      {customFields.length > 0 ? (
        <Table
          aria-label="Case custom fields"
          verticalSpacing="sm"
          horizontalSpacing={0}
          highlightOnHover
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={styles.fieldLabel} fw={500}>
                Field
              </Table.Th>
              <Table.Th className={styles.fieldLabel} fw={500}>
                Value
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {customFields.map(([label, value]) => (
              <Table.Tr key={label}>
                <Table.Td>
                  <Text fw={600}>{label}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{value}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" fz={14}>
          No custom fields for this case.
        </Text>
      )}
    </Stack>
  )
}
