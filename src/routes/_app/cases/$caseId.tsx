import { CaseDetailPage } from '#/components/pages/CaseDetailPage'
import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { recordRecentlyViewed } from '#/lib/recentlyViewed'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

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

  // Feed the search palette's "Recently viewed" list.
  useEffect(() => {
    recordRecentlyViewed({
      type: 'case',
      id: caseId,
      label: `#${caseId} ${caseDetail.title}`,
      route: {
        to: '/cases/$caseId/$tab',
        params: { caseId, tab: 'details' },
      },
    })
  }, [caseId, caseDetail.title])

  return <CaseDetailPage caseDetail={caseDetail} caseId={caseId} />
}
