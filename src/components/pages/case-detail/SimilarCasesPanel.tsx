import { caseSimilarQueryOptions } from '#/components/Cases/casesQueries'
import { SimilarCaseTable } from '#/components/Cases/SimilarCaseTable'
import { Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CasePanelHeader } from './CasePanelHeader'

/**
 * The case detail "Similar" tab: other cases sharing one or more observables with
 * this case. Reuses the shared `SimilarCaseTable` (also used by the alert drawer).
 */
export function SimilarCasesPanel({ caseId }: { caseId: string }) {
  const navigate = useNavigate()
  const { data, isPending, isError } = useQuery(caseSimilarQueryOptions(caseId))

  const openCase = (id: string) =>
    void navigate({
      to: '/cases/$caseId/$tab',
      params: { caseId: id.replace(/^#/, ''), tab: 'details' },
    })

  return (
    <Stack gap="md" p="lg">
      <CasePanelHeader label="Similar cases" />
      {isError ? (
        <Text fz={13} c="red.6">
          Couldn't load similar cases.
        </Text>
      ) : isPending ? (
        <Text fz={13} c="dimmed">
          Loading similar cases…
        </Text>
      ) : (
        <SimilarCaseTable rows={data} onOpen={openCase} />
      )}
    </Stack>
  )
}
