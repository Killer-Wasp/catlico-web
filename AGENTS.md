<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# catlico-web

## Collaboration Principles

- Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements. When running unattended, pick the most reasonable interpretation, proceed, and record the assumption rather than blocking.
- Implement the simplest solution for simple problems, and better solutions for harder problems. Do not over-engineer or add flexibility that is not needed yet.
- Do not touch unrelated code. Surface bad code or design smells you discover so they can be addressed as separate issues.
- Flag uncertainty explicitly. If unsure, ask before proceeding. When useful, conduct a small, localized, low-risk experiment, then bring the hypothesis and results back for discussion. Confidence without certainty causes more damage than admitting a gap.
- Suggest better approaches when they would improve the work, especially when they have a longer-lasting impact than a tactical change.

## Frontend Structure

- TanStack Start provides file-based routing conventions for `src/routes/`; use this structure for the rest of `src/`:

```text
src/
├── components/
│   ├── ui/                  # Base UI primitives
│   ├── pages/               # Route page components imported by route files
│   ├── <domain>/            # Domain-specific groupings, e.g. cases/, alerts/
│   └── ...                  # Shared components used across multiple routes
├── db/
│   ├── index.ts             # Database client
│   └── schema.ts            # Table definitions
├── hooks/                   # Custom React hooks
├── lib/                     # Non-UI utilities, data fetching, helpers
├── routes/
│   ├── posts/
│   │   ├── route.tsx        # Directory route for /posts; parent layout for child routes
│   │   ├── index.tsx        # Index route for /posts
│   │   └── $slug.tsx        # Dynamic route for /posts/:slug
│   ├── _account/
│   │   ├── route.tsx        # Pathless layout route; wraps children without adding /account
│   │   ├── orders.tsx       # Route for /orders
│   │   └── profile.tsx      # Route for /profile
│   ├── __root.tsx           # Root route; wraps the entire app
│   ├── index.tsx            # Index route for /
│   ├── about.tsx            # Route for /about
│   ├── robots[.]txt.ts      # File route for /robots.txt
│   └── $.tsx                # Catch-all / splat route
├── global.css               # Global styles imported by __root.tsx
├── router.tsx               # Router instance and app router setup
└── routeTree.gen.ts         # Generated route tree; do not edit manually
```

- Keep the entire routing layer in `src/routes/`. TanStack Router generates `src/routeTree.gen.ts` from this directory automatically.
- `src/routes/__root.tsx` is the root of the route tree. Every other route renders inside its outlet, so it is the place for app-wide providers, analytics, global navigation, and the root `<html>` shell for SSR.
- Use directory routes for parent/child URL relationships. For example, `routes/posts/route.tsx` is the layout for `/posts` and `/posts/*`, while `routes/posts/index.tsx` renders `/posts`.
- Use pathless layout routes with an underscore prefix. For example, `_account/route.tsx` wraps child routes without adding `/account` to the URL, so `_account/orders.tsx` renders `/orders`.
- Use dynamic route filenames like `$slug.tsx`; the filename becomes the params key, e.g. `params.slug`.
- Escape dots in special file routes with brackets, e.g. `robots[.]txt.ts` maps to `/robots.txt`. These server routes export `createServerFileRoute` handlers instead of standard `createFileRoute` routes.
- Use `$.tsx` for catch-all / splat routes when unmatched URLs should render a fallback page.
- Keep `src/routes/` focused on TanStack Router route files, route layouts, loaders, and route-level orchestration.
- Put route page components in `src/components/pages/` when they are more than thin route wiring, then import them from route files.
- Put reusable UI in `src/components/`, grouped by domain when it belongs to one feature area and by shared component name when it is used across routes.
- Put non-UI helpers, API clients, data transforms, and other shared utilities in `src/lib/`.
- Treat `src/routeTree.gen.ts` as generated output. Do not edit it by hand; regenerate routes when needed.
- Do not use Next.js or Remix patterns in this TanStack Start app. Use TanStack Start APIs such as `createServerFn` for server-only work.

## UI

- This project uses **Mantine v9** for UI. Apply v9 conventions (not older versions).
- For Mantine APIs, components, theming, and hooks, consult the LLM-optimized docs: https://mantine.dev/llms.txt (index) or https://mantine.dev/llms-full.txt (full content)
- Put styles in a co-located `.module.css` file rather than Mantine component style props (`c`, `bg`, `ff`, `fz`, `fw`, `lts`, `mt`, `w`, etc.) or inline `style`. Reference Mantine theme tokens via their CSS variables (e.g. `color: var(--mantine-color-red-6)`, `var(--mantine-color-dimmed)`) so styling still flows from the theme.
- Prefer Mantine components (`Text`, `Flex`, `Box`, `Group`, `Stack`, etc.) over raw HTML elements like `div` plus CSS.

## Tests

- Keep tests in the root `tests/` directory, mirroring the related `src/` path where practical.
- Do not add new `*.test.*` or `*.spec.*` files under `src/`.
- Import application code from tests with the configured source aliases (`#/*` or `@/*`) rather than relying on colocated relative imports.

## Agent Skills (TanStack Intent)

- This repo uses [TanStack Intent](https://tanstack.com/ai/latest/docs/getting-started/agent-skills) to ship AI-agent guidance alongside its dependencies. The `intent-skills` block at the top of this file is auto-managed by the CLI — don't hand-edit between the `<!-- intent-skills:start -->` / `:end -->` markers.
- **TanStack AI** is installed (`@tanstack/ai` + the `@tanstack/ai-anthropic` adapter). It bundles the `ai-core` skill set, which teaches agents the correct TanStack AI patterns (use `chat()` not `streamText()`, `anthropicText()` not a raw provider client, `toServerSentEventsResponse()` not manual SSE, middleware hooks not `onFinish` callbacks).
- Before writing any TanStack AI code (chat, streaming, tool calling, structured outputs, media generation, adapters), load the matching skill and follow its `SKILL.md`:
  - `pnpm dlx @tanstack/intent@latest list` — list available skills
  - `pnpm dlx @tanstack/intent@latest load @tanstack/ai#ai-core` — entry point; routes to sub-skills (`chat-experience`, `tool-calling`, `adapter-configuration`, `structured-outputs`, `middleware`, `media-generation`, `ag-ui-protocol`, `custom-backend-integration`, `debug-logging`)
- Skills are versioned with the package: bumping `@tanstack/ai` updates the skill content automatically. Re-run `pnpm dlx @tanstack/intent@latest install` only after adding another intent-enabled package or to refresh the mappings.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map 1:1 to their label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
