import type {
  CaseDetail,
  CaseDetailAlert,
} from '#/components/Cases/caseDetails.types'
import { CaseDescription } from './CaseDescription'
import {
  caseKeys,
  updateCaseDescription,
} from '#/components/Cases/casesQueries'
import { SEV } from '#/lib/domain'
import { Box, Group, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import styles from './styles.module.css'
import { TrafficBadge } from './CaseSummaryCard'

export function DetailsPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const queryClient = useQueryClient()
  const saveDescription = useMutation({
    mutationFn: (markdown: string) => updateCaseDescription(caseId, markdown),
    onSuccess: (_data, markdown) => {
      // Reflect the saved value immediately in the cached detail (the tab reads
      // it via useSuspenseQuery), then refetch to reconcile with the server.
      queryClient.setQueryData(
        caseKeys.fullDetail(caseId),
        (old: CaseDetail | undefined) =>
          old ? { ...old, descriptionMarkdown: markdown } : old,
      )
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) })
    },
  })

  return (
    <Stack gap="lg" p="lg">
      <CaseDescription
        markdown={caseDetail.descriptionMarkdown}
        onSave={(markdown) => saveDescription.mutateAsync(markdown)}
      />

      {caseDetail.summary && (
        <Text fz={15} lh={1.45} c="var(--desc)">
          <Text component="span" fw={700}>
            Working hypothesis:
          </Text>{' '}
          {caseDetail.summary}
        </Text>
      )}

      <Box>
        <Text className={styles.fieldLabel} mb="sm">
          Linked alerts
        </Text>
        <Stack gap={0}>
          {caseDetail.linkedAlerts.map((alert) => (
            <LinkedAlertRow key={alert.id} alert={alert} />
          ))}
        </Stack>
      </Box>
    </Stack>
  )
}

function LinkedAlertRow({ alert }: { alert: CaseDetailAlert }) {
  return (
    <Group
      gap="sm"
      wrap="nowrap"
      py={10}
      style={{ borderBottom: '1px solid var(--line-soft)' }}
    >
      <Text ff="monospace" fz={13} c="dimmed" w={64}>
        {alert.id}
      </Text>
      <Box
        w={4}
        h={22}
        bg={`var(--sev-${SEV[alert.sev]})`}
        style={{ borderRadius: 3, flexShrink: 0 }}
      />
      <Text fw={600} truncate>
        {alert.title}
      </Text>
      <TrafficBadge label="TLP" value={alert.tlp} />
    </Group>
  )
}
