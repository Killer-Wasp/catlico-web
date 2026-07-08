import { CaseDetailPage } from '#/components/pages/CaseDetailPage'
import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/$caseId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(caseDetailQueryOptions(params.caseId)),
  component: CaseDetailRoute,
})

function CaseDetailRoute() {
  const { caseId } = Route.useParams()
  // Read from the live query (the loader warmed its cache) rather than the
  // loader snapshot, so edits — e.g. reassigning the case — re-render here.
  const { data: caseDetail } = useSuspenseQuery(caseDetailQueryOptions(caseId))
  return <CaseDetailPage caseDetail={caseDetail} caseId={caseId} />
}
