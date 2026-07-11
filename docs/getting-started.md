# Getting started

Set up `catlico-web` for local development.

For the full multi-service stack (API + worker + web), see `DEVELOPMENT.md` in the workspace root.

## Prerequisites

- **Node.js 20+**
- **[pnpm](https://pnpm.io/)** — this repo uses a pnpm workspace (`pnpm-workspace.yaml`); npm
  and yarn will not resolve it correctly
- A running **[catlico-api](https://github.com/jimmyruann/catlico-backend)** on `:8000`

## Setup

```bash
git clone https://github.com/jimmyruann/catlico-web.git
cd catlico-web

pnpm install
cp .env.example .env
pnpm dev
```

The dev server runs on **[localhost:3000](http://localhost:3000)**.

### Environment

One variable, in `.env`:

```bash
# Base URL of the catlico-api. The dev backend serves /api/v1 on :8000.
# Leave unset to default to a same-origin "/api/v1" (e.g. behind a proxy).
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

It must be absolute and it must include the `/api/v1` path. The client appends relative paths
(`alerts/`) to it, so a missing trailing segment silently drops part of the URL.

### Logging in

The backend seeds a local admin: `admin@example.com` / `changeme`.

## Everyday commands

```bash
pnpm dev              # Vite dev server on :3000
pnpm build            # production build
pnpm preview          # serve the production build
pnpm test             # vitest run
pnpm lint             # eslint
pnpm format           # prettier --write . && eslint --fix
pnpm check            # prettier --check .
pnpm generate-routes  # tsr generate — regenerate src/routeTree.gen.ts
```

> **The test suite currently has 9 known failures** across `tests/routes/_app/-alerts.test.tsx`
> and `tests/components/Observables/observablesQueries.test.ts` (282 of 291 pass). They are
> pre-existing and unrelated to the build. Don't assume you broke something.

## Project structure

```
src/
  routes/          TanStack Router file-based routes — routing concerns only
  components/
    pages/         Page entry components (<Name>Page.tsx) + per-page subfolders
    <Domain>/      Reusable cross-page domain modules (query hooks, types, helpers)
    ui/            Base UI primitives
    Table/         The shared list-page table shell
  lib/
    api/client.ts  The single network seam (ky)
    auth/          Session storage, login/logout, redirect sanitisation
    domain.ts      Severity / TLP / PAP scales, mirrored from the backend
    filters.ts     Filter serialization, mirrored from the backend
  routeTree.gen.ts Generated — never edit by hand
tests/             Mirrors src/ paths
```

Each of `src/routes/`, `src/lib/`, and `src/components/` carries an `AGENTS.md` with local
conventions. Read those before adding files.

## Adding a page

1. Create the page component at `src/components/pages/<Name>Page.tsx`. Its building blocks
   (tables, drawers, columns, styles) go in a co-located kebab-case folder,
   `src/components/pages/<name>/`.
2. Write `src/components/<Domain>/<domain>Queries.ts` with a key factory, fetchers, and
   `queryOptions`. See [data-fetching.md](data-fetching.md).
3. Add the route file under `src/routes/_app/`, prefetching in the `loader` with
   `ensureQueryData` and rendering the page component.
4. The route tree regenerates automatically; if it doesn't, run `pnpm generate-routes`.

Everything under `src/routes/_app/` sits behind the auth guard and the app shell. Routes that
must be exempt (like `login.tsx`) live outside that folder.

## Conventions worth knowing before your first PR

- **UI is [Mantine v9](https://mantine.dev/)**, not Tailwind. Use Mantine components (`Text`,
  `Group`, `Stack`, `Box`) over raw HTML plus CSS. Consult
  [mantine.dev/llms.txt](https://mantine.dev/llms.txt) for v9 APIs.
- **Styles go in co-located `.module.css` files**, not Mantine style props (`c`, `bg`, `fz`,
  `mt`, …) or inline `style`. Reference theme tokens via CSS variables
  (`var(--mantine-color-red-6)`). A lone one-off `fz` on a single element is fine; *repeated*
  style bundles move to CSS.
- **Import with the `#/` alias** (`#/lib/domain`), not deep relative paths.
- **Tests live in the root `tests/` directory**, mirroring the `src/` path. Do not add
  `*.test.*` files under `src/`.
- This is **TanStack Start**. Use `createServerFn` for server-only work — never Next.js or
  Remix patterns.

## A note on Tailwind

`@tailwindcss/vite` is still wired into `vite.config.ts` and listed in `package.json`, but
**nothing in `src/` uses it**. It is residue from the TanStack Start scaffold. Mantine is the
real design system. The Tailwind plugin can be removed without affecting any component.

## Troubleshooting

**Blank page, 401s in the console** — the backend isn't running, or `VITE_API_BASE_URL` is
wrong. The client refreshes an expired token once, then clears the session and redirects to
`/login`.

**CORS errors** — set `BACKEND_CORS_ORIGINS=http://localhost:3000` in the API's `.env`.

**Hard refresh bounces me to `/login`** — expected only if the token really has expired. The
`_app` route sets `ssr: false` precisely so the auth guard runs on the client, where
`localStorage` exists. If you remove `ssr: false`, every refresh will bounce.

**A filter does nothing** — the backend silently drops malformed filter terms. Check the
serialization in `src/lib/filters.ts` against the backend's `app/crud/_filters.py`.

## Where to go next

- [data-fetching.md](data-fetching.md) — the four-layer TanStack Query pattern
- [architecture.md](architecture.md) — routing, auth, the shared table shell
- [`AGENTS.md`](../AGENTS.md) — full conventions
