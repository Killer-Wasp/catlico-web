import { caseDetailQueryOptions } from '#/components/Cases/casesQueries'
import { Route as CaseShellRoute } from '#/routes/_app/cases/$caseId'
import { Route as CaseTabRoute } from '#/routes/_app/cases/$caseId/$tab'
import { describe, expect, test, vi } from 'vitest'

function loaderContext() {
  return {
    queryClient: {
      ensureQueryData: vi.fn(async (options: unknown) => options),
    },
  }
}

type RouteLoader = (args: unknown) => Promise<unknown>

describe('case detail routes', () => {
  test('prefetches full case detail data for the case shell route', async () => {
    const context = loaderContext()

    const loader = CaseShellRoute.options.loader as RouteLoader
    await loader({
      context,
      params: { caseId: '1842' },
    })

    expect(context.queryClient.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: caseDetailQueryOptions('1842').queryKey,
      }),
    )
  })

  test('prefetches full case detail data for tab routes', async () => {
    const context = loaderContext()

    const loader = CaseTabRoute.options.loader as RouteLoader
    await loader({
      context,
      params: { caseId: '1842', tab: 'tasks' },
    })

    expect(context.queryClient.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: caseDetailQueryOptions('1842').queryKey,
      }),
    )
  })
})
