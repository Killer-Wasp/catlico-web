# Data fetching — TanStack Query pattern

How every feature talks to the server. Four layers, one direction of dependency.
**Alerts is the reference implementation** — copy its shape for new features.

```
src/lib/api/client.ts                  ← the only place fetch() is called
src/integrations/tanstack-query/       ← QueryClient + defaults (staleTime, retry)
src/components/<Feature>/<feature>Queries.ts  ← keys + fetchers + queryOptions
src/routes/.../<feature>.tsx           ← loader prefetch (ensureQueryData)
src/routes/.../-<Feature>Page.tsx      ← read with useSuspenseQuery
```

## Adding a feature ("upcoming")

1. **Types + data** live in `<feature>Data.ts` (already the convention).

2. **`<feature>Queries.ts`** — copy `alertsQueries.ts`:
   - a hierarchical **key factory** (`thingKeys`) — never hand-write key arrays;
   - **fetchers** returning typed data (mock today, `apiFetch<T>(...)` once the
     API lands — signatures don't change);
   - **`queryOptions(...)`** units binding a key to a fetcher.

3. **Prefetch in the route loader** so the cache is warm before render:

   ```ts
   export const Route = createFileRoute('/_app/things')({
     loader: ({ context }) =>
       context.queryClient.ensureQueryData(thingsQueryOptions()),
     component: ThingsPage,
   })
   ```

4. **Read in the component** with the _same_ `queryOptions` — cache hit, no refetch:

   ```ts
   const { data } = useSuspenseQuery(thingsQueryOptions())
   ```

   Detail routes pass params: `useSuspenseQuery(thingQueryOptions(id))`.

## Mutations + invalidation

After a write, invalidate by key prefix — broad or narrow:

```ts
queryClient.invalidateQueries({ queryKey: thingKeys.all }) // everything
queryClient.invalidateQueries({ queryKey: thingKeys.detail(id) }) // one row
```

## Notes

- `apiFetch` throws `ApiError` (carries `status`); the QueryClient retry policy
  skips 4xx and retries 5xx/transient twice.
- Tests render the page under a `QueryClientProvider` + `Suspense` boundary —
  see `-alerts.test.tsx`.
- Set `VITE_API_BASE_URL` to point at the backend (defaults to `/api/v1`).
