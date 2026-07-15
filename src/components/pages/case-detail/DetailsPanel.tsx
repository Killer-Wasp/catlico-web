import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { CaseDescription } from './CaseDescription'
import {
  caseKeys,
  updateCaseDescription,
} from '#/components/Cases/casesQueries'
import { PluginResultsPanel } from '#/components/PluginResults/PluginResultsPanel'
import { Divider, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'

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

      <PluginResultsPanel
        entityType="case"
        entityId={caseId.replace(/^#/, '')}
      />

      {/* Plugin results stay keyed to a promoted alert (§4.1b) — surface them
          from the case via the same entity-polymorphic panel, one per linked
          alert, so enrichment gathered during triage remains visible here. */}
      {caseDetail.linkedAlerts.length > 0 && (
        <Stack gap="md">
          <Divider
            label="Linked alert enrichment"
            labelPosition="left"
          />
          {caseDetail.linkedAlerts.map((linkedAlert) => (
            <Stack key={linkedAlert.id} gap="xs">
              <Title order={6} size="h6" c="dimmed">
                {linkedAlert.id} · {linkedAlert.title}
              </Title>
              <PluginResultsPanel
                entityType="alert"
                entityId={linkedAlert.id.replace(/^AL-/, '')}
              />
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
