# Route conventions

Scope: everything under `src/routes/`. Complements the root `AGENTS.md` and
`src/components/AGENTS.md`.

TanStack Router generates `src/routeTree.gen.ts` from this directory. **Never edit that
file by hand.**

## Route files stay thin

A route file owns routing concerns only: `validateSearch`, `loaderDeps`, `loader`,
`beforeLoad`, and the wiring of search params to props. **Page markup lives in
`src/components/pages/<Name>Page.tsx`** and is imported here. There are no
`-ComponentName.tsx` colocated page files in this tree.

```
routes/
  __root.tsx              # root of the tree; app-wide providers
  login.tsx               # outside _app → no shell, no auth guard
  _app.tsx                # pathless layout: AppShell + auth guard
  _app/
    cases/index.tsx       # /cases
    cases/$caseId.tsx     # /cases/:caseId  (+ $caseId/$tab.tsx)
    settings.$section.tsx # /settings/:section
```

## `_app.tsx` is the auth boundary

Everything nested under `_app` renders inside the `AppShell` and behind the guard.
Routes that must be exempt (`login.tsx`) live **outside** the folder and therefore skip
the layout entirely.

`_app` sets **`ssr: false`** deliberately. Auth state lives in `localStorage`, which does
not exist during SSR, so running the guard and every child loader on the client is what
lets a hard refresh stay logged in instead of bouncing to `/login`. Do not remove
`ssr: false` or move the guard server-side without solving that first. It is also why
`localStorage` and `useLocalStorage` are safe inside this subtree.

`beforeLoad` throws `redirect({ to: '/login', search: { returnUrl: … } })`. Always pass
the return URL through `sanitizeReturnUrl` from `#/lib/auth/redirects` — it is what stops
an open-redirect.

## Loaders prefetch; components read

The loader warms the shared QueryClient cache; the page reads the **same** `queryOptions`
with `useSuspenseQuery` and hits a warm cache instead of refetching.

```ts
export const Route = createFileRoute('/_app/cases/')({
  validateSearch: validateCaseSearch,
  loaderDeps: ({ search }) => ({ filter: search.filter }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(casesQueryOptions(filters)),
      context.queryClient.ensureQueryData(caseFacetsQueryOptions()),
    ]),
  component: CasesRoute,
})
```

Rules that make this work:

- Use `ensureQueryData`, never `fetchQuery` — it is the cache-respecting call.
- **A loader that depends on search params must declare `loaderDeps`.** Without it the
  loader won't re-run when the param changes, and the page silently shows stale data.
- The loader and the component must call the *same* `queryOptions(...)` factory with the
  same arguments. Building the options inline in either place breaks the cache hit.
- `queryOptions` and key factories live in `src/components/<Domain>/<domain>Queries.ts`,
  not here.

## Search params are typed state

Declare `validateSearch` and keep filter state in the URL. Update it through `navigate`
with a functional `search` updater and `replace: true`, so filtering doesn't push a
history entry per keystroke:

```ts
navigate({ to: '.', replace: true, search: (prev) => ({ ...prev, filter }) })
```

Filter serialization (`filter=key~op~value`) is shared with the backend — the helpers are
in `#/lib/filters.ts`, and per-resource parsing in `#/components/<Domain>/<domain>FilterSearch.ts`.

## Naming

- Directory routes for parent/child URLs (`cases/index.tsx`, `cases/$caseId.tsx`).
- Underscore prefix for pathless layouts (`_app`) — wraps children without adding a segment.
- `$param.tsx` for dynamic segments; the filename becomes the params key.
- Escape dots in file routes with brackets (`robots[.]txt.ts`); those export
  `createServerFileRoute`, not `createFileRoute`.
- `$.tsx` for catch-all/splat fallbacks.

This is TanStack Start. Use `createServerFn` for server-only work — never Next.js or
Remix patterns.
