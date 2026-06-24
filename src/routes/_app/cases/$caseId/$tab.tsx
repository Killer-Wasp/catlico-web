import type { CaseTab } from '#/components/pages/CaseDetailPage'
import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CASE_TABS, CaseTabPanel } from '#/components/pages/CaseDetailPage'

export const Route = createFileRoute('/_app/cases/$caseId/$tab')({
  beforeLoad: ({ params }) => {
    // Unknown tab segments fall back to the default Details tab.
    if (!CASE_TABS.includes(params.tab as CaseTab)) {
      throw redirect({
        to: '/cases/$caseId/$tab',
        params: { caseId: params.caseId, tab: 'details' },
      })
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(caseDetailQueryOptions(params.caseId)),
  component: CaseTabRoute,
})

function CaseTabRoute() {
  const { tab, caseId } = Route.useParams()
  // Read from the live query (the loader warmed its cache) rather than the
  // loader snapshot, so edits — e.g. saving the description — re-render here.
  const { data: caseDetail } = useSuspenseQuery(caseDetailQueryOptions(caseId))
  return (
    <CaseTabPanel
      tab={tab as CaseTab}
      caseDetail={caseDetail}
      caseId={caseId}
    />
  )
}
