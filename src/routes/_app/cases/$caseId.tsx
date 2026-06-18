import { CaseDetailPage } from '#/components/pages/CaseDetailPage'
import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/$caseId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(caseDetailQueryOptions(params.caseId)),
  component: CaseDetailRoute,
})

function CaseDetailRoute() {
  const { caseId } = Route.useParams()
  const caseDetail = Route.useLoaderData()
  return <CaseDetailPage caseDetail={caseDetail} caseId={caseId} />
}
