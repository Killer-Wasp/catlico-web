/**
 * Org-admin import of the MITRE ATT&CK catalog. The backend fetches the
 * official CTI enterprise-attack bundle server-side; this panel just triggers
 * it and reports the result. Backend enforces write:organisation (403 for
 * non-admins), surfaced here as an error notice.
 */
import {
  attackCatalogQueryOptions,
  importAttackCatalog,
  invalidateCatalogQueries,
} from '#/components/Attack/attackQueries'
import { notifyError } from '#/components/pages/settings/settingsUi'
import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DownloadCloud } from 'lucide-react'

export function AttackCatalogPanel() {
  const qc = useQueryClient()
  const catalog = useQuery(attackCatalogQueryOptions())

  const importMutation = useMutation({
    mutationFn: importAttackCatalog,
    onSuccess: (result) => {
      invalidateCatalogQueries(qc)
      notifications.show({
        color: 'teal',
        title: 'ATT&CK catalog imported',
        message: `${result.created} new, ${result.updated} updated (${result.total} techniques).`,
      })
    },
    onError: (err) => notifyError(err, 'Failed to import ATT&CK catalog'),
  })

  return (
    <Stack gap="md" maw={640}>
      <Title order={3} fz={15}>
        ATT&CK catalog
      </Title>
      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fz={14}>
              {catalog.isPending
                ? 'Loading catalog…'
                : catalog.isError
                  ? "Couldn't load catalog size."
                  : catalog.data.length
                    ? `${catalog.data.length} techniques in the catalog.`
                    : 'Catalog is empty.'}
            </Text>
            <Text c="dimmed" fz={12}>
              Fetches the official MITRE CTI enterprise-attack bundle
              server-side and upserts techniques by ATT&CK ID. Safe to re-run.
              Requires org-admin permissions.
            </Text>
          </Stack>
          <Button
            leftSection={<DownloadCloud size={16} />}
            loading={importMutation.isPending}
            disabled={catalog.isPending}
            onClick={() => importMutation.mutate()}
          >
            {catalog.data?.length ? 'Update catalog' : 'Import catalog'}
          </Button>
        </Group>
      </Paper>
    </Stack>
  )
}
