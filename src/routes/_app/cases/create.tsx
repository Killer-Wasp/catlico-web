import { CreateCasePage } from '#/components/pages/CreateCasePage'
import { caseTemplatesQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/create')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(caseTemplatesQueryOptions()),
  component: CreateCasePage,
})
