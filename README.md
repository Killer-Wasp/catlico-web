# Catlico Web

**The web interface for [Catlico](https://github.com/jimmyruann/catlico-backend) — an
open-source security incident response platform.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-EF4444.svg)](https://tanstack.com/start)
[![Mantine v9](https://img.shields.io/badge/Mantine-v9-339AF0.svg?logo=mantine&logoColor=white)](https://mantine.dev/)

A single-page app for security analysts: triage alerts, work cases, pivot on observables, and
review the enrichment that plugins attach to them.

## Features

- **Case workspace** — tasks, logs, comments, attachments, custom fields, and MITRE ATT&CK
  linkage, in a tabbed detail view
- **Alert triage** — inbound alerts with promotion and merge into cases
- **Observables** — typed IOCs with TLP handling and plugin enrichment results
- **Filterable list views** — a shared table shell with tag-aware, clause-based filtering that
  round-trips through the URL
- **Knowledge base** — versioned pages with a rich-text editor
- **Settings** — organisations, roles, API keys, SLAs, notifiers, plugins, and plugin runners
- **Live updates** — WebSocket-driven notifications

## Quick start

Requires **Node.js 20+**, **[pnpm](https://pnpm.io/)**, and a running
[catlico-api](https://github.com/jimmyruann/catlico-backend) on `:8000`.

```bash
git clone https://github.com/jimmyruann/catlico-web.git
cd catlico-web

pnpm install
cp .env.example .env
pnpm dev
```

Open **[localhost:3000](http://localhost:3000)**. The backend's seeded login is
`admin@example.com` / `changeme`.

Full walkthrough: **[docs/getting-started.md](docs/getting-started.md)**.

## Stack

| Concern | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, Vite) |
| Routing | [TanStack Router](https://tanstack.com/router), file-based |
| Server state | [TanStack Query](https://tanstack.com/query) |
| HTTP | [ky](https://github.com/sindresorhus/ky) |
| UI | [Mantine v9](https://mantine.dev/) |
| Styling | CSS modules + Mantine theme tokens |
| Tests | [Vitest](https://vitest.dev/) + Testing Library |

> Tailwind's Vite plugin is still installed but **unused** — leftover from the TanStack Start
> scaffold. Mantine is the design system.

## How it fits together

```
src/routes/            routing, auth guard, loaders  ─┐
src/components/pages/  page components               ─┤ imports downward only
src/components/<Domain>/  reusable domain modules    ─┤
src/lib/               network seam, auth, contracts ─┘
```

Data flows through four layers: `lib/api/client.ts` is the only place the network is touched;
`<domain>Queries.ts` defines key factories and `queryOptions`; route loaders prefetch with
`ensureQueryData`; pages read the same options with `useSuspenseQuery` and hit a warm cache.

Everything under `src/routes/_app/` sits behind the auth guard. That subtree is deliberately
client-only (`ssr: false`) because auth state lives in `localStorage`.

See **[docs/architecture.md](docs/architecture.md)**.

## Documentation

| Doc | What's in it |
|---|---|
| [Getting started](docs/getting-started.md) | Setup, commands, adding a page, troubleshooting |
| [Architecture](docs/architecture.md) | Routing, auth, component organisation, shared backend contracts |
| [Data fetching](docs/data-fetching.md) | The four-layer TanStack Query pattern |

Contributors and AI agents: [`AGENTS.md`](AGENTS.md), plus per-directory notes in
`src/routes/`, `src/lib/`, and `src/components/`.

## Two contracts shared with the backend

These files mirror backend source and must change in lockstep:

- **`src/lib/domain.ts`** — the severity (`1–4`) and TLP/PAP (`0–3`) integer scales.
- **`src/lib/filters.ts`** — the `filter=key~op~value` wire format. The backend silently drops
  malformed terms, so a desync looks like "the filter did nothing," not an error.

## Related repositories

| Repo | Role |
|---|---|
| [catlico-backend](https://github.com/jimmyruann/catlico-backend) | The API. The only service with database credentials. |
| [catlico-plugin-runner](https://github.com/Killer-Wasp/catlico-plugin-runner) | Sandboxes and executes plugins |
| [catlico-plugin-sdk](https://github.com/Killer-Wasp/catlico-plugin-sdk) | The plugin authoring contract |

The web app **never** talks to a plugin runner. It talks only to the API.

## Contributing

Issues and pull requests welcome. Run `pnpm lint` and `pnpm test` before opening a PR.

Note that the test suite currently has **9 known pre-existing failures** (282 of 291 pass) in
`tests/routes/_app/-alerts.test.tsx` and `tests/components/Observables/observablesQueries.test.ts`.

## License

[GNU Affero General Public License v3.0](LICENSE).
