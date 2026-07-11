# Library conventions

Scope: everything under `src/lib/`. Complements the root `AGENTS.md`.

Non-UI utilities: the network seam, auth/session, domain scales, and filter
serialization. **Nothing here imports from `src/components/`.** Dependencies point
one way — components and routes import `lib`, never the reverse.

## `api/client.ts` — the single network seam

`api` is a configured **`ky`** instance and the only place `fetch()` is called. Base URL,
auth headers, and the 401-refresh flow are defined exactly once.

```ts
const page = await api.get('alerts/').json<Page<Alert>>()
```

- Non-2xx responses reject with ky's **`HTTPError`** (`error.response.status`). Branch on
  it with `isHTTPError` imported from `ky`.
- It attaches `Authorization: Bearer <access token>` and `X-Organisation-Id` (org-scoped
  backend routes reject requests without the header).
- On a `401` it transparently refreshes the access token **once** and retries. Concurrent
  401s share one refresh via a module-level `refreshPromise`, so a burst of parallel
  queries triggers a single refresh call. Preserve that de-duplication.
- Paths are **relative and have no leading slash** (`'alerts/'`). ky resolves them against
  `baseUrl`, which must be absolute and end in a slash — a leading slash on the input, or
  a missing trailing slash on the base, silently drops the last path segment.
- `VITE_API_BASE_URL` overrides the base; it defaults to `/api/v1` and is resolved against
  `window.location.origin` when relative.

The four-layer data-fetching pattern (client → `queryOptions` → loader prefetch →
`useSuspenseQuery`) is documented in [`docs/data-fetching.md`](../../docs/data-fetching.md);
`alertsQueries.ts` is the reference implementation. That doc replaced the old
`src/lib/api/README.md`, which had gone stale — it described an `apiFetch` throwing a custom
`ApiError` and route-colocated `-<Feature>Page.tsx` files, none of which exist.

## `auth/` — session and redirects

`session.ts` owns token storage (`localStorage`), `login`/`logout`, and `isAuthenticated`.
This is why the `_app` route tree sets `ssr: false`; see `src/routes/AGENTS.md`.

`redirects.ts` exists to prevent open redirects. **Always pass a return URL through
`sanitizeReturnUrl`** before putting it in a `redirect(...)` or a login link. Use
`loginHref` / `redirectToLogin` rather than constructing `/login?returnUrl=…` by hand.

`client.ts` imports `clearSession` and `redirectToLogin`, so a failed refresh drops the
session and bounces to login from one place.

## `domain.ts` — the domain scales, mirrored from the backend

`Severity` (`1|2|3|4`), `Tlp`/`Pap` (`0|1|2|3`), `CaseStatus`, plus the shared option lists
and colour maps (`SEVERITY_OPTIONS`, `TLP_OPTIONS`, `TLP_COLOR`).

These integers mirror `catlico-api/app/models/` — `2 = medium` severity, `2 = AMBER` TLP.
**Changing one side without the other silently mislabels the UI.** Import these instead of
redeclaring per page; feature-specific maps (connector `VERDICT_COLOR`, task status maps)
stay in that page's folder.

## `filters.ts` — a cross-repo wire contract

The list views' clause-based filters. Every list endpoint takes repeated
`filter=key~op~value` params: **terms are OR'd within a key and AND'd across keys.** `op`
is `eq` (exact) or `co` (case-insensitive substring). Tag keys use a `tag:` prefix
(`tag:tlp`, `tag:kill-chain:phase`).

`appendClauses(params, clauses)` is the serializer. This format is the mirror image of
`catlico-api/app/crud/_filters.py` — **change both repos together, or filtering breaks
silently** (the backend drops malformed terms rather than erroring, so a serialization bug
looks like "the filter did nothing").

## `ui-helpers.ts`

`useStamp()` and `errorMessage(error)`. `errorMessage` is the one place raw errors become
user-facing text — route error UI through it instead of rendering `String(err)`.

## Style

- Import application code with the `#/*` alias (`#/lib/domain`), not deep relative paths.
- Keep this directory free of React components. Hooks that are genuinely non-visual
  (`useStamp`) are fine; anything rendering markup belongs in `src/components/`.
