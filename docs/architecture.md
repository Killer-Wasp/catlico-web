# Architecture

`catlico-web` is a [TanStack Start](https://tanstack.com/start) single-page app. It talks to
exactly one backend — `catlico-api` — and never to a plugin runner.

## Stack

| Concern | Choice |
|---|---|
| Framework | TanStack Start (React 19, Vite) |
| Routing | TanStack Router, file-based |
| Server state | TanStack Query |
| HTTP | `ky` |
| UI | Mantine v9 |
| Styling | CSS modules + Mantine theme tokens |
| Tests | Vitest + Testing Library (jsdom) |

Tailwind's Vite plugin is still installed but unused — scaffold residue. Mantine is the design
system.

## Layering

```
routes/          routing, guards, loaders, search-param validation
  ↓ imports
components/pages/    page entry components + per-page building blocks
  ↓ imports
components/<Domain>/ reusable cross-page modules: query hooks, types, helpers
  ↓ imports
lib/                 network seam, auth, domain scales, filter serialization
```

Dependencies point downward. **`lib/` never imports from `components/`.**

## Routing

The tree is generated into `src/routeTree.gen.ts` from `src/routes/`. Never edit it by hand.

- **`__root.tsx`** — root of the tree; app-wide providers and the SSR shell.
- **`_app.tsx`** — a *pathless* layout route. Everything nested under it renders inside the
  Mantine `AppShell` and behind the auth guard. It adds no URL segment.
- **`login.tsx`** lives outside `_app/`, so it skips both the shell and the guard.
- Directory routes give parent/child URLs (`cases/index.tsx` → `/cases`,
  `cases/$caseId.tsx` → `/cases/:caseId`).
- `$param.tsx` filenames become the params key. `$.tsx` is a catch-all.

Route files stay thin: they own `validateSearch`, `loaderDeps`, `loader`, `beforeLoad`, and
the wiring of search params to props. **Page markup lives in `components/pages/`.**

## Authentication

Auth state lives in `localStorage`, which does not exist during server rendering. So `_app`
sets **`ssr: false`**, and the whole authed area renders client-only.

That is deliberate: running the guard and every child loader on the client is what lets a hard
refresh stay logged in instead of bouncing to `/login`. It is also why `useLocalStorage` is
safe anywhere inside that subtree. Removing `ssr: false` breaks refresh persistence.

`beforeLoad` throws `redirect({ to: '/login', search: { returnUrl } })`. Return URLs **must**
pass through `sanitizeReturnUrl` from `lib/auth/redirects.ts` — that is the open-redirect guard.

The token lifecycle is owned by `lib/api/client.ts`: it attaches the bearer token and the
`X-Organisation-Id` header, transparently refreshes once on a 401, de-duplicates concurrent
refreshes, and on failure clears the session and redirects. Nothing else touches the network.

## Server state

See [data-fetching.md](data-fetching.md) for the full pattern. The short version: a route
loader calls `ensureQueryData(xQueryOptions(args))` to warm the shared cache; the page reads
the *same* `queryOptions` with `useSuspenseQuery` and gets a cache hit.

Query keys come from hierarchical key factories (`caseKeys`, `alertKeys`), which are the one
established camelCase exception to the `SCREAMING_SNAKE_CASE` constant convention.

## Component organisation

Everything a single page owns lives under `components/pages/`:

- The page entry is `pages/<Name>Page.tsx`. Route files import only these.
- That page's building blocks — tables, drawers, columns, cells, per-page helpers, styles —
  live in a co-located kebab-case folder, `pages/<page>/`.

`components/<Domain>/` is reserved for **reusable, cross-page** modules only: domain types,
query hooks, and helpers shared by more than one page. If a component belongs to exactly one
page, it belongs in `pages/<page>/`.

Genuinely shared UI gets its own top-level folder (`Severity/`, `StatusBadge/`, `Tag/`, `ui/`).

### The table shell

`Table/` is one reusable list-page shell: `TablePanel` (frame + header/count/action slots),
`DataTable` (generic `<T>` with sorting and loading/error/empty states), `TableFilterBar`,
`TablePagination`, `useTableTokens`, and shared filter functions.

A new list page supplies only its `buildXColumns` factory, data wiring, and page-specific
header actions.

## Shared contracts with the backend

Two files mirror backend source and **must be changed in lockstep with it**:

| File | Mirrors | Breaks if desynced |
|---|---|---|
| `lib/domain.ts` | Severity / TLP / PAP integer scales | The UI silently mislabels severity or TLP |
| `lib/filters.ts` | `filter=key~op~value` wire format | Filters silently do nothing — the backend drops malformed terms rather than erroring |

Severity is `1=low … 4=critical`. TLP/PAP is `0=WHITE, 1=GREEN, 2=AMBER (default), 3=RED`.

## Styling

- Co-locate a `styles.module.css` with each `pages/<page>/` folder.
- Shared design tokens (`--sev-*`, `--tlp-*`, `--line-soft`, `--muted`) are defined once on the
  `.page` scope and referenced as `var(--…)`.
- Do not create shared Mantine style-prop objects and spread them. Express repeated typography
  as CSS module classes.

## Testing

Vitest + jsdom. Tests live in the root `tests/` directory, mirroring `src/` paths, and import
via the `#/` alias. Pages render under a `QueryClientProvider` and a `Suspense` boundary.
