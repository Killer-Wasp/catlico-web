import { ObservablesPage } from '#/components/pages/ObservablesPage'
import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/observables')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(observablesQueryOptions()),
  component: ObservablesPage,
})
