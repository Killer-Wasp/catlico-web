import { CaseTemplatesPage } from '#/components/pages/CaseTemplatesPage'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/case-templates/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(caseTemplatesQueryOptions()),
  component: CaseTemplatesPage,
})
