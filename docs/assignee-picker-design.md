# Assignee Picker (bulk assign) — Design

Status: **implemented**, verified in-browser (not yet covered by automated tests).

A reusable "Assign to" control that bulk-assigns the selected rows of a table to a
user, backed by a server-side user search. Used by the Tasks queue
([`TasksPage.tsx`](../src/components/pages/TasksPage.tsx)) and the Cases list
([`CasesPage.tsx`](../src/components/pages/CasesPage.tsx)); both already had a row
multi-select mode, this replaces their ad-hoc "Assign to" menus with one component.

## Shape

```
[ Select ] → check rows → [ Assign to ▾ ]
                              └─ Search people… (server-side, debounced)
                                 ◍ Ada Lovelace      ← UserAvatar + display name
                                 ◍ Analyst
```

Picking a user fires one PATCH per selected row (`Promise.all`), shows a toast, and
exits select mode. Errors surface as a red toast (see *Org-membership constraint*).

## Components

| Piece | File | Role |
| --- | --- | --- |
| `AssignMenu` | [`Table/AssignMenu.tsx`](../src/components/Table/AssignMenu.tsx) | Trigger button + searchable menu. Owns the search box, debounce, and query. Emits `onAssign(user)`. |
| `UserAvatar` | [`Users/UserAvatar.tsx`](../src/components/Users/UserAvatar.tsx) | A user's picture, or colored initials fallback. |
| `usersQueries` | [`Users/usersQueries.ts`](../src/components/Users/usersQueries.ts) | `UserPublic` type, `userDisplayName`, `searchUsers` / `userSearchQueryOptions`. |
| `assignTask` | [`Tasks/tasksQueries.ts`](../src/components/Tasks/tasksQueries.ts) | `PATCH cases/{c}/tasks/{t}` with `assignee_id`. Cases reuse `updateCaseAssignee`. |

`AssignMenu` is intentionally decoupled from what's being assigned — it only knows
"pick a user." The page owns the mutation (which rows, which endpoint, what toast).

## Decisions

### Search is server-side, not client-filtered
The menu calls `GET /users/search?q=` on each (debounced 200 ms) keystroke rather than
fetching everyone and filtering locally. Scales past a handful of users and lets the
backend own the match logic (email + first/last + full-name). `userSearchQueryOptions`
uses `placeholderData: (prev) => prev` so the list doesn't flash empty between
keystrokes, and the query is `enabled` only while the menu is open.

### Typing must not fight Mantine Menu's keyboard nav
A `TextInput` inside a `Menu.Dropdown` is a known trap: Menu's typeahead/arrow handling
steals keystrokes, and an earlier version collapsed the menu (and select mode) on the
first character. Fix: **controlled `opened` state** + `onKeyDown={(e) => e.stopPropagation()}`
on the search input + `data-autofocus`. Don't remove these.

### Avatars stream through the authed API client
`GET /users/{id}/avatar` requires a Bearer token, so a bare `<img src>` can't
authenticate. `UserAvatar` fetches the blob via `api` (`.blob()`), hands Mantine an
object URL, and **revokes it on unmount**. `has_avatar === false` → colored initials
(`avatarFor`) with no request. `UserAvatar` accepts any row carrying the identity
fields (`Pick<UserPublic, 'id' | 'email' | 'first_name' | 'last_name' | 'has_avatar'>`),
not only a full `UserPublic`.

### Display name: real name, then email fallback
`userDisplayName` = `"{first} {last}"` when present, else the email-derived name
(`caseUsers.displayName`, e.g. `j.tanaka@x` → "J. Tanaka"). The backend now stores
`first_name`/`last_name`, but they're nullable, so the fallback stays.

## API contract

```
GET /users/search?q=<str>&limit=<1..50>  ->  200 list[UserPublic]
```
- **Scoped to the active org's members.** `q` matches email / first / last / full name;
  blank `q` returns the first `limit` members. `limit` clamped to 1–50. Declared before
  `/{user_id}` so `search` isn't parsed as a UUID.
- Depends on `ActiveOrgContext` → **requires the `X-Organisation-Id` header** and that
  the caller has access to that org. (The web client always sends it.)

Assignment: `PATCH /cases/{caseId}/tasks/{taskId}` (or `PATCH /cases/{caseId}`) with
`assignee_id`.

## Org-membership constraint (why the search is org-scoped)

The backend rejects assigning a task/case to someone who isn't a **member of that item's
org** (422 `"Assignee must be a member of the …organisation"`). So the picker's data
source must agree with the assignment rule, or it would offer users who then 422 — e.g. a
superadmin who can *see* every org but isn't a *member* of this one.

Fix (chosen over graceful-error / disable-rows / per-item endpoint): scope
`GET /users/search` to the caller's active-org members
([`crud/user.py::search_users`](../../catlico-api/app/crud/user.py) joins
`OrganisationMember` on `ctx.organisation_id`;
[`routes/users.py`](../../catlico-api/app/api/v1/routes/users.py) supplies it from
`ActiveOrgContext`). The picker now only offers assignable users.

**Trade-offs / seams:**
- **Auth surface widened the requirement:** `/users/search` went from "any authenticated
  user" to "active-org context." Only the assignee picker consumes it, and it always
  sends the header — but a header-less caller now gets rejected.
- **Cross-org edge:** the rule is "member of the item's *creator* org"; the search filters
  by the caller's *active* org. Identical for same-org work; they diverge only when one
  org edits another org's task/case. The `onError` toast still covers that case. If it
  becomes real, a per-item `…/assignable-users` endpoint is the exact fix.

## Verified in-browser
- `q=` and `q=adm` → 200; debounced to one request per settled query.
- Assigning a **non-member** (superadmin) → 422, red toast, no state change.
- Assigning a **member** → 200, avatar appears in the row, select mode exits.
- After org-scoping: the picker lists only org members; the non-member is gone.

## Follow-ups
- Automated tests: org-scoped `search_users` (member vs non-member, blank `q`), and an
  `AssignMenu` interaction test (search → pick → mutation fired, error toast on 422).
- Per-item assignable-users endpoint if cross-org editing ships.
