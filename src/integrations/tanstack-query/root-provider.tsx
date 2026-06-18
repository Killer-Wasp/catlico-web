import { QueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for 30s before a background refetch.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Retry transient/server errors only — never 4xx (auth, validation,
        // not-found), where retrying just repeats the same failure.
        retry: (failureCount, error) => {
          if (
            isHTTPError(error) &&
            error.response.status >= 400 &&
            error.response.status < 500
          ) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
