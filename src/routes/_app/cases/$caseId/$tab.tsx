import type { CaseTab } from '../$caseId'
import { getCaseDetail } from '#/components/Cases/caseDetailsData'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CASE_TABS, CaseTabPanel } from '../$caseId'

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
  component: CaseTabRoute,
})

function CaseTabRoute() {
  const { caseId, tab } = Route.useParams()
  const caseDetail = getCaseDetail(caseId)
  return <CaseTabPanel tab={tab as CaseTab} caseDetail={caseDetail} />
}
