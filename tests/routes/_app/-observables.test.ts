import { observablesQueryOptions } from '#/components/Observables/observablesQueries'
import { Route } from '#/routes/_app/observables'
import { describe, expect, test, vi } from 'vitest'

function loaderContext() {
  return {
    queryClient: {
      ensureQueryData: vi.fn(async (options: unknown) => options),
    },
  }
}

type RouteLoader = (args: unknown) => Promise<unknown>

describe('observables route', () => {
  test('prefetches observables for the page route', async () => {
    const context = loaderContext()
    const loader = Route.options.loader as RouteLoader

    await loader({ context })

    expect(context.queryClient.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: observablesQueryOptions().queryKey,
      }),
    )
  })
})
