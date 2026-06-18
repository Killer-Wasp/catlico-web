import { CasesPage } from '#/components/pages/CasesPage'
import {
  caseFacetsQueryOptions,
  casesQueryOptions,
} from '#/components/Cases/casesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  // Prefetch into the shared QueryClient cache; the page reads the same
  // queryOptions (default filters) and facets, so it hits a warm cache.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(casesQueryOptions()),
      context.queryClient.ensureQueryData(caseFacetsQueryOptions()),
    ]),
  component: CasesPage,
})
