import { CasesPage } from '#/components/pages/CasesPage'
import {
  filterParamsToClauses,
  validateCaseSearch,
} from '#/components/Cases/caseFilterSearch'
import {
  DEFAULT_CASE_FILTERS,
  caseFacetsQueryOptions,
  casesQueryOptions,
} from '#/components/Cases/casesQueries'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/')({
  validateSearch: validateCaseSearch,
  loaderDeps: ({ search }) => ({ filter: search.filter }),
  // Prefetch into the shared QueryClient cache; the page reads the same
  // queryOptions (default filters) and facets, so it hits a warm cache.
  loader: ({ context, deps }) => {
    const clauses = filterParamsToClauses(deps.filter)
    const filters = clauses.length
      ? { ...DEFAULT_CASE_FILTERS, clauses }
      : DEFAULT_CASE_FILTERS
    return Promise.all([
      context.queryClient.ensureQueryData(casesQueryOptions(filters)),
      context.queryClient.ensureQueryData(caseFacetsQueryOptions()),
    ])
  },
  component: CasesRoute,
})

function CasesRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <CasesPage
      filterParams={search.filter}
      onFilterParamsChange={(filter) =>
        navigate({
          to: '.',
          replace: true,
          search: (prev) => ({ ...prev, filter }),
        })
      }
    />
  )
}
