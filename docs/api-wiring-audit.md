# catlico-web — Stub / Mock Audit & API-Wiring Plan

Audit of every place in `catlico-web` that renders hardcoded / mocked data or
fakes a result instead of talking to `catlico-api`, plus the plan to connect each
to the API and remove dead mock code.

## Context

`catlico-web` (TanStack Start + TanStack Query + `ky`) is partway through being
wired to the `catlico-api` backend. The documented pattern (see
[src/lib/api/README.md](../src/lib/api/README.md)) is a 4-layer flow with
**Alerts as the reference implementation**:

```
src/lib/api/client.ts                          ← the only network seam (exports `api`, a ky instance)
src/components/<Feature>/<feature>Queries.ts   ← key factory + fetchers + queryOptions
src/routes/.../<feature>.tsx                   ← loader prefetch (ensureQueryData)
src/components/pages/<Feature>Page.tsx         ← read via useSuspenseQuery / useQuery
```

A file is **CONNECTED** when its fetchers import `api` from `#/lib/api/client`.
It is **STUBBED** when it returns hardcoded arrays/objects, fakes results in
local `useState`, or wires buttons to `notify()` instead of a mutation.

Backend routers that currently exist (mounted in
`catlico-api/app/api/v1/main.py`): `auth, users, organisations, roles, cases,
tasks, logs, alerts, observables, comments, case_templates, connectors,
enrichment_jobs, custom_fields`. Anything outside that list needs a **new backend
endpoint first**.

Goal: connect all remaining stubbed data to the API, adding backend endpoints
where none exist, and remove dead mock code.

---

## Already CONNECTED — no action

For reference, these are fully wired and follow the pattern correctly; do not touch:

- **Alerts** — `src/components/Alerts/alertsQueries.ts` (list, detail, promote, merge)
- **Cases** — `src/components/Cases/casesQueries.ts` (list, facets, detail, create-from-template, description/assignee patch, comments, observables, attachments, task work-logs)
- **Case Templates** — `src/components/Cases/caseTemplatesQueries.ts` (full CRUD + import/export). Note: `caseTemplatesList` builtins in `caseTemplates.ts` are intentional constants, not stubs.
- **Observables / Tasks** — `observablesQueries.ts`, `tasksQueries.ts`
- **Connectors** — `src/components/Connectors/connectors.ts` (`fetchConnectors`, `setConnectorEnabled`, `saveConnectorConfig`, `testConnectorConfig`) and `connectorJobs.ts`
- **Auth** — `src/lib/auth/session.ts` `login()` → `POST auth/login`, refresh flow in `client.ts`; `LoginPage.tsx` is real
- **Settings (connected panels)** — Organisations, Org Profile (name/description), Custom Fields, Users (member/role reads) via `settingsQueries.ts`

---

## TIER 1 — Backend endpoint EXISTS, finish the frontend wiring

These panels already fetch real data; the gap is **mutations / form submits that
currently call `notify()` or hold `defaultValue` without an `onChange`**. Add the
fetcher + `useMutation` and invalidate the relevant query key (copy the
`createCustomField`/`deleteCustomField` shape already in `settingsQueries.ts`).

| Item | File | Stub | Wire to |
|---|---|---|---|
| Users — Invite / Edit | `Settings/panels/UsersPanel.tsx:36-39, 72-77` | buttons call `notify()` | `POST users/` (invite), `PATCH users/{id}` |
| Org Profile — timezone / TLP | `Settings/panels/OrgProfilePanel.tsx:82-110` | dropdowns have `defaultValue`, no `onChange`; not posted | include in existing `PATCH organisations/{id}` mutation |
| Custom Fields — Add | `Settings/panels/CustomFieldsPanel.tsx:43-49` | "+ Add field" → `notify()` | `POST custom-fields/` (`createCustomField` fetcher already exists in settingsQueries.ts) |
| Profiles — Save | `Settings/panels/ProfilesPanel.tsx:24-37, 141-147` | falls back to `profiles` from settingsData; "Save profile" → `notify()`; checkboxes use `defaultChecked` | `GET roles/` (exists), add `POST roles/` + `PATCH roles/{id}` mutation |
| Connectors — Configure / Add | `Settings/panels/ConnectorsPanel.tsx:54-61, 95-100`, `IntegrationsPanel.tsx:48-57` | "Add MISP", "Configure", "Reconnect", "Refresh catalog" → `notify()` | reuse `saveConnectorConfig` / `setConnectorEnabled` already in connectors.ts; the config modal exists, just unbind from `notify()` |
| Audit Log | `Settings/panels/AuditLogPanel.tsx:32-49` | renders `auditEvents` from settingsData; "Export CSV" → `notify()` | backend records audit (`record_audit` / `AuditPublic`, and `cases/{id}/activity` exists) but **no global list route is mounted** — add `GET audit/` (org-scoped, paginated) then wire an `auditQueries.ts` |

> Audit Log straddles tiers: the data model exists server-side but a global
> list endpoint does not. Treat the endpoint as a small Tier-2 backend add, then
> wire the panel as Tier 1.

---

## TIER 2 — No backend route yet (add endpoint, then wire frontend)

Each needs: (1) a `catlico-api` router + models + CRUD, then (2) a
`<feature>Queries.ts` in web following `alertsQueries.ts`, prefetch in the route
loader, and replacing the local `useState` / hardcoded import with
`useSuspenseQuery` + mutations.

### Big pages

- **Functions** — `src/components/pages/FunctionsPage.tsx`
  - `initialFunctions` hardcoded (`:83-206`); list/save/toggle all mutate local `useState` (`:986-1087`).
  - `runFunction()` (`:1024-1052`) prints a **fake hardcoded console transcript** — not a real execution.
  - Needs: `functions/` CRUD + `POST functions/{id}/test` (real run) + `POST functions/{id}/toggle`. Extract list/editor into `src/components/Functions/` with `functionsQueries.ts`.

- **Knowledge Base** — `src/components/KnowledgeBase/knowledgeBase.ts:3-120`
  - `initialKnowledgeBasePages` hardcoded; `createDraftKnowledgeBasePage` (`:136-146`) builds client-only drafts that never persist.
  - Needs: `knowledge-base/` CRUD (pages with block content). Add `knowledgeBaseQueries.ts`; update `KnowledgeBasePage.tsx` to read/mutate via the API.

- **Header notifications** — `src/components/Header/Header.tsx:31-70`
  - `initialNotifications` hardcoded; mark-read / mark-all-read mutate local state only (`:93-101, 150-154`).
  - Hardcoded **"JT" avatar initials** (`:222`) — should come from the authenticated user (add `GET users/me` / derive from session and feed initials).
  - Needs: `notifications/` list + `PATCH notifications/{id}` + `POST notifications/read-all`. Add `notificationsQueries.ts`.

### Settings panels backed by `settingsData.ts`

All of the following render hardcoded arrays from `src/components/Settings/settingsData.ts`
with non-functional toggles/buttons. Each needs a new backend router + a queries file.

| Panel | File | settingsData source | New endpoint(s) |
|---|---|---|---|
| API Keys | `Settings/panels/ApiKeysPanel.tsx` | `apiKeys` (:164-168) | `GET/POST api-keys/`, `DELETE api-keys/{id}` |
| Observable Types | `Settings/panels/ObservableTypesPanel.tsx` | `observableTypes` (:97-110) | `GET/POST observable-types/`, `DELETE …/{id}` (note: `check_creatable_type` exists in cases/alerts — confirm whether a types table already backs it) |
| SLA Policies | `Settings/panels/SlaPanel.tsx` | `slaPolicies` (:157-162) | `GET sla-policies/`, `PUT sla-policies/` (bulk) |
| Taxonomies / Freetags | `Settings/panels/TaxonomiesPanel.tsx` | `taxonomies` (:112-119), `freetags` (:121-131) | `GET/PATCH taxonomies/`, `GET/POST freetags/` |
| Notification Rules / Notifiers | `Settings/panels/NotificationsPanel.tsx` | `notificationRules` (:133-148), `notifiers` (:150-155) | `GET/PATCH notification-rules/`, `GET/PATCH notifiers/`, `POST notifiers/{id}/test` |
| Organisation Links | `Settings/panels/OrganisationsPanel.tsx:341-356` | `orgLinks` (:35-38) | `GET/POST/DELETE organisations/{id}/links` |

Note: `resources` (:48-80) and `verbs` (:82-95) in settingsData are permission
reference data for the Profiles UI — they can stay as constants or be derived
from the roles API; not a network stub per se.

---

## TIER 3 — Cleanup (after wiring, remove dead mock code)

- **`caseDetails.ts` mock** — delete the hardcoded `caseDetails` array (`:159-520`) and `getCaseDetail()` (`:530-535`); they are **not imported anywhere** (real data flows through `fetchCaseDetail` + `toCaseDetail`). Keep the `toCaseDetail`/`toCaseDetailTaskLog` mappers.
- **Navbar fallback** — once tasks load reliably, drop the `initialTasks` fallback and `fixtureCounts` (`Navbar.tsx:30, 57-59, 200`). Other badges already use real query data with `undefined` when loading.
- **`alerts.fixtures.ts`** — `initialAlerts` is test-only; keep it under tests, ensure no runtime import.
- **`initialConnectors`** — empty array in `connectors.ts:36`; remove if unused.
- After each Tier-1/2 panel is wired, delete its corresponding array from `settingsData.ts`; remove the file once empty.

---

## Suggested execution order

1. **Tier 1 mutations** — quickest wins, backend already there (Users, Org Profile fields, Custom Fields add, Profiles save, Connectors configure). One PR per panel or grouped.
2. **Audit log endpoint + panel** — small backend add, then wire.
3. **Tier 2 big pages** — Notifications (+ user identity for avatar), Knowledge Base, Functions. Each = backend router + web queries file. Largest effort; Functions `test run` is the deepest (real sandboxed execution).
4. **Tier 2 settings panels** — API Keys, Observable Types, SLA, Taxonomies, Notification Rules/Notifiers, Org Links.
5. **Tier 3 cleanup** — remove dead mocks as each feature lands.

---

## Verification

- **Pattern conformance**: for each newly wired feature, confirm fetchers import `api` from `#/lib/api/client`, the route loader calls `ensureQueryData`, and the page reads the same `queryOptions`. Cross-check against `alertsQueries.ts` + `-alerts.test.tsx`.
- **No remaining runtime stubs**: `rg -n "from './settingsData'" src` should return nothing once panels are migrated; `rg -n "initialFunctions|initialNotifications|initialKnowledgeBasePages|getCaseDetail" src` should be empty after cleanup.
- **End-to-end**: run the backend (`make` in catlico-api, serves `/api/v1` on :8000) and web with `VITE_API_BASE_URL=http://localhost:8000/api/v1`. For each migrated panel/page: load it (data comes from API, not fixtures), perform a create/update/delete, and confirm the change persists across a refresh.
- **Mutations invalidate**: after a write, the list/badge updates without a manual reload (query key invalidation wired).
- **Tests**: add/extend page tests under `tests/` mirroring `src/` paths, rendering under `QueryClientProvider` + `Suspense` as the README describes.
