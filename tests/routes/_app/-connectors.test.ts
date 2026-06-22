import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import { Route } from '#/routes/_app/connectors'
import { describe, expect, test, vi } from 'vitest'

function loaderContext() {
  return {
    queryClient: {
      ensureQueryData: vi.fn(async (options: unknown) => options),
    },
  }
}

type RouteLoader = (args: unknown) => Promise<unknown>

describe('connectors route', () => {
  test('prefetches the connector catalog for the page route', async () => {
    const context = loaderContext()
    const loader = Route.options.loader as RouteLoader

    await loader({ context })

    expect(context.queryClient.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: connectorsQueryOptions().queryKey,
      }),
    )
  })
})
