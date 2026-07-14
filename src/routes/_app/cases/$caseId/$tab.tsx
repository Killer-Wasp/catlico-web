import type { CaseTab } from '#/components/pages/CaseDetailPage'
import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CASE_TABS, CaseTabPanel } from '#/components/pages/CaseDetailPage'

export const Route = createFileRoute('/_app/cases/$caseId/$tab')({
  // `?comment=<id>` deep-links a specific comment on the Comments tab — the
  // panel scrolls to it and briefly highlights it on mount.
  validateSearch: (search: Record<string, unknown>): { comment?: string } =>
    typeof search.comment === 'string' ? { comment: search.comment } : {},
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
  const { comment } = Route.useSearch()
  // Read from the live query (the loader warmed its cache) rather than the
  // loader snapshot, so edits — e.g. saving the description — re-render here.
  const { data: caseDetail } = useSuspenseQuery(caseDetailQueryOptions(caseId))
  return (
    <CaseTabPanel
      tab={tab as CaseTab}
      caseDetail={caseDetail}
      caseId={caseId}
      highlightCommentId={comment}
    />
  )
}
