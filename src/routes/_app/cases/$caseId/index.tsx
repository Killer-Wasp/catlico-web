import { createFileRoute, redirect } from '@tanstack/react-router'

// A bare /cases/$caseId has no tab segment — send it to the default
// Details tab so the active tab is always reflected in the URL.
export const Route = createFileRoute('/_app/cases/$caseId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/cases/$caseId/$tab',
      params: { caseId: params.caseId, tab: 'details' },
    })
  },
})
