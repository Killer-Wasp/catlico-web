# Data fetching

How every feature talks to the server. Four layers, one direction of dependency.
**Alerts is the reference implementation** — copy the shape of `alertsQueries.ts`.

```
src/lib/api/client.ts                        ← the only place the network is touched
src/integrations/tanstack-query/             ← QueryClient + defaults (staleTime, retry)
src/components/<Feature>/<feature>Queries.ts ← key factory + fetchers + queryOptions
src/routes/.../<feature>.tsx                 ← loader prefetch (ensureQueryData)
src/components/pages/<Feature>Page.tsx       ← read with useSuspenseQuery
```

## The client

`api` is a configured **[ky](https://github.com/sindresorhus/ky)** instance and the single
network seam. Base URL, auth headers, and the 401-refresh flow are defined in exactly one place.

```ts
import { api } from '#/lib/api/client'

const page = await api.get('alerts/').json<Page<Alert>>()
```

- Non-2xx responses reject with ky's **`HTTPError`** (`error.response.status`). Branch on it
  with `isHTTPError` imported from `ky`.
- The current access token is attached as `Authorization: Bearer`, and the active org as
  `X-Organisation-Id` — org-scoped backend routes reject requests without the header.
- On a `401`, the token is refreshed **once** and the request retried. Concurrent 401s share
  one refresh via a module-level promise, so a burst of parallel queries triggers a single
  refresh call.
- Paths are **relative with no leading slash** (`'alerts/'`). ky resolves them against
  `baseUrl`, which must be absolute and end in a slash. A leading slash on the input — or a
  missing trailing slash on the base — silently drops the last path segment.
- `VITE_API_BASE_URL` overrides the base. It defaults to `/api/v1` and is resolved against
  `window.location.origin` when relative.

## Adding a feature

**1. Write `<feature>Queries.ts`** in `src/components/<Feature>/`, copying `alertsQueries.ts`:

- a hierarchical **key factory** (`thingKeys`) — never hand-write key arrays;
- **fetchers** returning typed data via `api.<method>(...)`, mapping DTOs to UI types;
- **`queryOptions(...)`** units binding a key to a fetcher.

**2. Prefetch in the route loader** so the cache is warm before render:

```ts
export const Route = createFileRoute('/_app/things')({
  loader: ({ context }) => context.queryClient.ensureQueryData(thingsQueryOptions()),
  component: ThingsPage,
})
```

**3. Read in the component** with the *same* `queryOptions` — cache hit, no refetch:

```ts
const { data } = useSuspenseQuery(thingsQueryOptions())
```

Detail routes pass params: `useSuspenseQuery(thingQueryOptions(id))`.

### Rules that make this work

- Use `ensureQueryData`, never `fetchQuery` — it is the cache-respecting call.
- **A loader that depends on search params must declare `loaderDeps`.** Without it the loader
  won't re-run when the param changes, and the page silently shows stale data.
- The loader and the component must call the same `queryOptions(...)` factory with the same
  arguments. Building the options inline in either place breaks the cache hit.

## Mutations and invalidation

After a write, invalidate by key prefix — broad or narrow:

```ts
queryClient.invalidateQueries({ queryKey: thingKeys.all })        // everything
queryClient.invalidateQueries({ queryKey: thingKeys.detail(id) }) // one row
```

## Filters are a cross-repo contract

List views serialize filters as repeated `filter=key~op~value` query params. **Terms are OR'd
within a key and AND'd across keys.** `op` is `eq` (exact) or `co` (case-insensitive
substring). Tag keys carry a `tag:` prefix (`tag:tlp`, `tag:kill-chain:phase`).

`appendClauses` in `src/lib/filters.ts` is the serializer. It mirrors
`app/crud/_filters.py` in the backend. **Change both repos together** — the backend silently
drops malformed terms rather than erroring, so a serialization bug looks like "the filter did
nothing."

## Retry policy

The QueryClient (`src/integrations/tanstack-query/root-provider.tsx`) skips retries on 4xx and
retries transient/5xx failures twice, branching on `isHTTPError`.

## Testing

Tests render the page under a `QueryClientProvider` and a `Suspense` boundary — see
`tests/routes/_app/-alerts.test.tsx`. Import application code with the `#/` alias, not deep
relative paths.
