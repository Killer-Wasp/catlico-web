import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { Box, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { CasePanelHeader } from './CasePanelHeader'
import styles from './styles.module.css'

export function CustomFieldsPanel({
  customFields,
}: {
  customFields: CaseDetail['customFields']
}) {
  return (
    <Stack gap="lg" p="lg">
      <CasePanelHeader label="Custom fields" />

      {customFields.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          {customFields.map(([label, value]) => (
            <Box key={label}>
              <Text className={styles.fieldLabel} mb={4}>
                {label}
                {label === 'Data classification' ? (
                  <Text component="span" c="red">
                    {' '}
                    *
                  </Text>
                ) : null}
              </Text>
              <Paper bg="gray.0" withBorder radius="sm" px="sm" py={8}>
                <Text>{value}</Text>
              </Paper>
            </Box>
          ))}
        </SimpleGrid>
      ) : (
        <Text c="dimmed" fz={14}>
          No custom fields for this case.
        </Text>
      )}
    </Stack>
  )
}
