import { CasesPage } from '#/components/pages/CasesPage'
import { casesQueryOptions } from '#/components/Cases/casesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  // Prefetch into the shared QueryClient cache; the page reads the same
  // queryOptions via useSuspenseQuery, so it hits a warm cache.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(casesQueryOptions()),
  component: CasesPage,
})
