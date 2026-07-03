# Component & page structure standards

Scope: everything under `src/components/`. Complements the root `AGENTS.md`.

## Page structure

Everything a single route/page owns lives under `src/components/pages/`:

- The **page entry component** is `pages/<Name>Page.tsx` (e.g. `AlertsPage.tsx`,
  `SettingsPage.tsx`). Route files under `src/routes/` import only these
  `*Page` components (plus the small public surface a page re-exports, e.g.
  `CaseTabPanel`).
- That page's **building-block components** (tables, drawers, columns, cells,
  panels, per-page helpers/constants, styles) live in a co-located,
  kebab-case subfolder `pages/<page>/`.

```
src/components/
  pages/
    AlertsPage.tsx
    alerts/            AlertDetailDrawer.tsx, alertColumns.tsx,
                       tableFns.ts, styles.module.css
    CasesPage.tsx          cases-list/…
    CaseDetailPage.tsx     case-detail/…
    CreateCasePage.tsx     create-case/…
    CaseTemplatesPage.tsx  case-templates/…
    ObservablesPage.tsx    observables/…
    TasksPage.tsx          tasks/…
    ConnectorsPage.tsx     connectors/…
    ConnectorJobsPage.tsx  connector-jobs/…
    FunctionsPage.tsx      functions/…
    KnowledgeBasePage.tsx  knowledge-base/…
    SettingsPage.tsx       settings/  (settings/panels/, settingsQueries.ts, …)
  <Domain>/            # reusable domain layer only, e.g. Alerts/, Cases/, Connectors/
  ui/                  # base UI primitives
  Severity/ StatusBadge/ Table/ Tag/ Navbar/ Header/   # shared components
```

- **`components/<Domain>/` is reserved for reusable, cross-page modules only** —
  domain types, query hooks, and helpers shared by more than one page/route
  (`Cases/caseDetails.types.ts`, `Cases/casesQueries.ts`, `Alerts/alertsQueries.ts`).
  If a component or module belongs to exactly one page, it lives under
  `pages/<page>/`, not here — e.g. `CaseDescription`/`mentionSuggestion` live in
  `pages/case-detail/`, the settings panels + their config drawer live in
  `pages/settings/`.
- Genuinely shared UI components live in their own top-level folder
  (`Severity/`, `StatusBadge/`, `Table/`, `Tag/`, `ui/`). The list-page table
  shell is one reusable component: `Table/` provides `TablePanel` (Paper frame +
  header/count/actions slots), `DataTable` (generic `<T>` thead/tbody + sort +
  loading/error/empty states), `TableFilterBar` + `TablePagination`,
  `useTableTokens` (token↔column-filter bridge), `tableFilters.ts` (shared
  `includesOne`/`includesAnyTag`/`includesAnySubstring` filter fns), `columnMeta.ts`
  (the `ColumnMeta` augmentation), and `TokenSearch`. A new list page supplies only
  its `buildXColumns` factory, data wiring, and page-specific header actions.
- A page's building blocks import reusable modules by absolute path
  (`#/components/<Domain>/…`) and their own siblings by relative path
  (`./Foo`). Page entry files import their subfolder relatively (`./alerts/…`).

## File naming

- **Component files → PascalCase**: any file whose primary export is a React
  component, including small collections of related components
  (`Badges.tsx`, `Pills.tsx`, `Cells.tsx`, `Fields.tsx`, `Panels.tsx`).
- **Helper / data / column-factory files → camelCase**: files that export
  functions, constants, types, or table column builders — `constants.ts`,
  `tableFns.ts`, `model.ts`, `taskHelpers.ts`, `columnMeta.ts`,
  `alertColumns.tsx` (builder that returns column defs, not a component).

## Constants

- Module-level constant values use `SCREAMING_SNAKE_CASE`
  (`SEVERITY_OPTIONS`, `TLP_COLOR`, `STATUS_COLOR`, `PROFILE_OPTIONS`,
  `TAB_OPTIONS`, `SAMPLE_CODE`). Exception: TanStack Query **key factories**
  stay camelCase by established convention (`caseKeys`, `alertKeys`,
  `settingsKeys`).
- **Reusable, cross-feature** constants derived from the domain scales
  (severity / TLP / PAP option lists and colour maps) live in
  `src/lib/domain.ts` (`SEVERITY_OPTIONS`, `TLP_OPTIONS`, `TLP_COLOR`) — import
  them instead of redeclaring per page. Feature-specific maps (e.g. connector
  `VERDICT_COLOR`, task status maps) stay in that page's folder.

## Styling

- Do **not** create shared Mantine style-prop objects
  (`const headerProps = { ff: 'monospace', fz: 10, … }` spread as
  `{...headerProps}`). Express repeated typography/label styles as CSS module
  classes.
- Each `pages/<page>/` folder owns a co-located `styles.module.css`; its
  components apply the classes via `className={styles.xxx}`.
- Shared design tokens (`--sev-*`, `--tlp-*`, `--line-soft`, `--muted`, …) stay
  defined once on the `.page` scope in `Cases/CasesPage.module.css`; reference
  them as `var(--…)`. One-off inline Mantine props (a lone `fz`, `c`, `mb` on a
  single element) are fine — only *repeated* style bundles move to CSS.
