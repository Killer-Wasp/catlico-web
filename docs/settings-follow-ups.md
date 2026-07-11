# Settings follow-ups

Work deferred from the Settings audit (PR #4). That PR covered correctness bugs
and cross-cutting UX (error states, confirmations, honest counts). The items
below are **feature additions** rather than fixes, so they were intentionally
left out to keep the PR focused.

## 1. NotificationsPanel — incomplete notifier/rule management

The query layer already exposes everything needed; the UI only wires up the
`enabled` toggle.

- [ ] **Rule → notifier linking.** `NotificationRulePublic.notifier_ids` and
  `updateNotificationRule` exist, but the UI can't edit which notifiers a rule
  targets. A rule can be "enabled" while wired to **zero** notifiers, silently
  doing nothing. Add a multiselect of notifiers per rule.
- [ ] **Surface `has_secrets` + allow secret rotation.** The API returns
  `has_secrets` (secrets are write-only) but the notifier list never shows it,
  and there's no way to update/rotate secrets after creation. Add a
  "secrets set" badge and an edit path.
- [ ] **Delete notifier.** `deleteNotifier` is exported but unused — notifiers
  can't be removed from the UI.
- [ ] Move JSON-config validation out of the `mutationFn` into the click handler.

## 2. Permission-gate write actions for non-superadmins

Several write endpoints require `SuperAdminUser`, but the UI shows the actions to
everyone, so non-superadmins get 403 error toasts instead of a disabled/hidden
control:

- [ ] Organisations create/delete (`POST`/`DELETE /organisations/`)
- [ ] Observable types create/delete
- [ ] Custom fields create/delete (`write:custom_field`)
- [ ] Profiles/roles (all `/roles` routes are superadmin-only)

Gate these on the user's actual permissions (hide or disable) rather than failing
at mutation time. (PR #4 already added `isError`/permission-denied empty states,
which partly mitigates the read-side 403s.)

## 3. Smaller panel gaps

- [ ] **Custom fields:** `options[]` (dropdown allowed-values) is hardcoded `[]`,
  so enum/dropdown fields can't be created; and `updateCustomField` exists but
  there's no edit path (can't toggle `mandatory`, change display name, etc.).
- [ ] **Taxonomies:** `deleteTag` exists but there's no delete UI; the
  "Import MISP taxonomy" and freetag "+ add" buttons are stub toasts.
- [ ] **API keys:** `scopes` and `expires_at` are supported by
  `ApiKeyCreateInput` but there's no UI to set them (the Scope column always
  renders `-`).
- [ ] **SLA policies:** no way to delete a policy — the backend
  `PUT /sla-policies/` is upsert-by-severity and never deletes, so removing a
  policy needs a new backend endpoint. (PR #4 added an `enabled` toggle as a
  partial mitigation.)
- [ ] **Integrations panel** is an intentional stub pointing at Plugins — make it
  a real link/button, and remove the now-unused `StatusBadge`/`IntegrationState`
  helpers in `settingsUi.tsx`.
