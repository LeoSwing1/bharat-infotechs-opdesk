# OPDesk — Changes in this session

Scope: branding fixes + a real, DB-backed permission system + fully functional
People and Teams modules (replacing placeholder pages), plus three pre-existing
bugs found and fixed while testing against a live Postgres database.

## 1. Branding
Fixed remaining "OpsDesk" → "OPDesk" text in: training page, all settings
sub-pages, login page default email, README, `.env.example`, and
`docs/README-INTEGRATIONS.md`. Internal identifiers were deliberately left
untouched (npm package name `opsdesk`, session cookie name `opsdesk_session`,
example DB name in `.env.example`) since renaming these risks breaking the app
for no user-visible benefit.

## 2. Permission system (was: 4 hardcoded role checks)
- `src/lib/permission-catalog.ts` — canonical list of ~28 permission keys
  across people/teams/tasks/projects/attendance/quality/warnings/leave/
  reports/admin, with sensible per-role defaults.
- New tables: `permissions` (catalog), `role_permissions` (org-configurable
  per-role grants), `team_authorities` (scoped grants — e.g. a Team Lead can
  be given one extra authority for a single specific team without changing
  their role).
- `src/lib/permissions.ts` — `hasPermission()` (org-wide) and
  `canAccessTeam()` (team-scoped) checks, backed by the DB with an in-memory
  cache that's invalidated on write. Super Admin always passes.
- `src/app/api/settings/permissions/route.ts` + `/settings/permissions` page
  — a live matrix UI where Super Admin toggles what each role can do.
  Verified live: toggling a grant immediately changes what a Team Lead's
  API calls are allowed to do, and toggling one permission does not clobber
  the role's other existing defaults.

## 3. People module (was: placeholder page with "—" fake stats)
- Schema: `users` gained `employeeCode`, `employmentType`, `designation`,
  `teamId`, `reportingManagerId`.
- `src/services/people/id-generator.ts` — generates permanent IDs in the
  `BI-EMP-26-00111` / `BI-INT-26-00021` format via a single atomic Postgres
  upsert (`ON CONFLICT ... SET last_number = last_number + 1`), so concurrent
  hires can never collide or skip a number. IDs never change when a person
  changes teams.
- Full CRUD API (`/api/people`, `/api/people/[id]`) with Zod validation,
  duplicate-email rejection, and permission checks on every write.
- Real UI: searchable table, create-person modal (returns a one-time
  temporary password), and a profile detail page with deactivate/reactivate.

## 4. Teams module (was: placeholder page with "—" fake stats)
- Schema: `teams` gained `hrUserId`, `departmentId`, `description`.
- Full CRUD API (`/api/teams`, `/api/teams/[id]`, `/api/teams/[id]/members`)
  with team-code uniqueness, member add/remove, and permission checks.
- Real UI: team cards with live member counts, create-team modal, and a
  detail page with member management.

## 5. Pre-existing bugs found and fixed while testing
1. **`passwordHash` leak** — `POST /api/people` and `PATCH /api/people/[id]`
   returned the full DB row including the bcrypt hash. Caught by live curl
   testing, not just code review. Fixed by stripping it before response.
2. **`db:seed` / `db:generate` were unusable** — `dotenv` and `server-only`
   were imported in several files but never added to `package.json`.
   Additionally, `server-only` unconditionally throws when imported outside
   Next's bundler, which would have crashed `db/seed.ts` even after adding
   the dependency, since it's imported via `db/index.ts`. Fixed by adding
   both packages as real dependencies and removing the `server-only` guard
   from the two files that are legitimately shared between the Next app and
   standalone scripts (`db/index.ts`, `services/people/id-generator.ts`).
3. **Unauthenticated API calls returned an HTML 307 redirect** instead of a
   JSON 401 — this breaks any non-browser API consumer and directly
   conflicts with the project's own Flutter-readiness requirement (proper
   HTTP status codes for a future mobile client). Fixed in `src/proxy.ts` to
   branch on `/api/` paths.

## 6. Database migration
Generated `drizzle/0000_thick_lightspeed.sql` (baseline — no prior migration
history existed in the archive; the project was using `db:push` for schema
sync). Applied and verified against a real Postgres 16 instance, along with
a full run of the updated seed script (produces
`BI-EMP-26-00001` / `BI-INT-26-00001` etc. exactly as specced).

## Verified live (not just typechecked)
Login, people list/create/detail/deactivate, teams list/create/detail/
member-add/member-remove, permission-matrix view/edit, and permission
enforcement (a Team Lead correctly blocked from team/person creation until
granted, then correctly allowed after, then correctly re-blocked after
revocation) — all tested via curl against a real Postgres database, not
Postgres mocks or demo mode.

## Not done yet (see project spec for full scope)
This spec describes a 70-section, 10-phase platform. This session covered
roughly Phase 1 (permissions) and part of Phase 2 (People, Teams, IDs) of
that plan. Still outstanding: ID card generation/QR, documents, attendance,
timesheets, projects/assignments/tasks workflow beyond what already existed,
daily updates, meetings + Google Calendar, quality/performance, warnings,
leave, recruitment/onboarding, tickets, announcements, payroll, expenses,
reports/exports, and Flutter-facing API polish (pagination, consistent error
shapes) beyond the one middleware fix made here.

---

# Session 2: Mobile web + Bearer auth + Attendance/Timesheets/Shifts + Flutter app

## 1. Mobile web fixes
- **Critical nav bug fixed**: the sidebar was `hidden ... md:flex` with zero
  mobile fallback — on a phone browser there was no way to navigate
  anywhere except sign out. Added a real hamburger + slide-in drawer
  (`src/components/layout/Sidebar.tsx`) with active-link highlighting.
- **Dashboard de-faked**: was 100% hardcoded numbers (`"64"`, `"6"`, `"38"`).
  Replaced with `GET /api/dashboard/summary`, which computes genuine,
  role-scoped counts (org-wide for Super Admin/HR, team-scoped for Team
  Leads, personal for everyone else), plus a mobile-responsive rewrite.

## 2. Bearer-token auth (the prerequisite for any mobile/API client)
- `getSession()` now accepts `Authorization: Bearer <token>` in addition to
  the web session cookie — same signed JWT either way.
- `POST /api/auth/login` returns `{ ok, user, token }`.
- Middleware updated: Bearer-only requests (no cookie) are no longer
  blocked before reaching the route handler, and unauthenticated API calls
  return a clean JSON `401` instead of an HTML redirect to `/login`.
- Verified live: logged in, then called `/api/people` and
  `/api/dashboard/summary` with **only** the Bearer header and zero cookie —
  both succeeded. Invalid tokens correctly rejected with 401.

## 3. Attendance (real, event-sourced)
- Schema: `attendance_events` (raw clock-in/out/break log — source of
  truth) rolling up into `attendance` (daily summary + correction audit
  fields).
- API: clock-in/out, break-start/end with correct state validation (no
  double clock-in, no break without clocking in, dangling breaks
  auto-close at clock-out), a manual-correction endpoint requiring a
  reason and fully audit-logged, and a history list.
- UI replaced the fake-stat placeholder with live clock in/out/break
  controls, a running timer, and a history table.
- **A real permission-scoping bug found via testing and fixed**: Team
  Leads correctly have `attendance.view` by default, but the first pass
  only checked that org-wide — meaning a TL could view *any* employee's
  attendance. Fixed and verified live: a TL now sees only their own team
  by default, can look up their own team's members, and gets a clean 403
  reaching for another team's data — the exact isolation the spec calls
  out by name in section 8.

## 4. Timesheets & Shifts
- New `shifts` table (name, code, start/end time, grace period) +
  `users.shiftId`. Full CRUD API + settings UI, and shift assignment wired
  into the People create form.
- `clockIn()` now uses the person's assigned shift for the late threshold
  instead of a hardcoded constant.
- Timesheets API reuses attendance data, computes real overtime against
  each person's actual shift length, supports employee/team/date-range
  filters, and a genuine CSV export (proper headers, correct quoting, real
  numbers).
- Permission scoping was consolidated into one shared
  `resolveAttendanceScope()` helper (`services/attendance/scope.ts`) used
  by both Attendance and Timesheets instead of duplicating the logic —
  verified live that the same team-isolation guarantee holds for
  Timesheets too.

## 5. Password change (closing the create → login loop)
Creating a person already generated a permanent employee ID and a one-time
temporary password, and that password already worked for login — verified
live end-to-end. What was missing: a way to change it afterward. Added
`POST /api/auth/change-password` (verifies the current password via
bcrypt before allowing a change) and a Security settings page. Verified
live, in order: wrong current password rejected (400) → correct change
succeeds → old password immediately stops working (401) → new password
logs in successfully.

## 6. Flutter mobile app (`mobile/opdesk_mobile/`)
A native client talking to the same REST API, using the Bearer-token auth
above. Built: API client with token injection (`flutter_secure_storage`),
typed models matching the exact JSON shapes verified live from the
backend, and full screens for Login, Dashboard (role-scoped), People
(list/create/detail/deactivate), Teams (list/create/detail/members), and
Roles & Permissions (Super Admin).

**Important honesty note**: I could not run `flutter analyze`, `pub get`,
or a build for this — the Dart SDK Flutter needs comes from
`storage.googleapis.com`, outside my allowed network domains. I checked
the code by hand as carefully as I could (matching JSON field names
against real API responses, programmatically verifying every relative
import resolves to a real file, catching and fixing a wrong
`DropdownButtonFormField` parameter name and an unreachable `endDrawer`
from nested Scaffolds) but this has **not** been compiler-verified the way
everything else in this changelog has. See `mobile/opdesk_mobile/README.md`
for exact setup steps and the honest list of what's NOT implemented
(Attendance/Tasks/Meetings screens, Calendar/WhatsApp/push — most of these
don't have complete backend APIs either).

## Verified live this session (real Postgres, not demo mode)
Mobile nav, dashboard real data, Bearer-token-only API access, full
attendance clock-in/break/clock-out lifecycle with correct state
validation, attendance permission-scoping fix (cross-team block
confirmed), shift creation + duplicate-code rejection, shift assignment,
timesheets with computed overtime, CSV export content and headers,
timesheets permission scoping, and the complete
create-person → temp-password → login → change-password → old-password-
invalidated → new-password-works chain.

## Not done yet
Per the phased priority list: Projects/Assignments/Daily Updates (Phase 4,
Tasks already existed), Meetings + Google Calendar/Notifications/Email/
WhatsApp/Push (Phase 5), Quality/Performance/Warnings (Phase 6), Leave/
Holidays/Recruitment/Onboarding (Phase 7), Tickets/Announcements/Payroll/
Expenses (Phase 8), Reports/Analytics/Exports (Phase 9), and the rest of
Phase 10. ID cards/QR and document management also remain outstanding.

---

# Session 3: Phase 4 (Projects/Assignments/Daily Updates) + login-by-ID + auto-generated emails

## 1. Phase 4: Projects, Assignments, Tasks (wired), Daily Updates
- New `projects`, `project_members`, `assignments` tables. `tasks` and
  `daily_updates` now reference `projectId`/`assignmentId` — completing the
  Project → Assignment → Task → Daily Update chain the spec calls the core
  operational loop.
- Permission model factored into a shared `canViewProject()`/
  `canManageProject()` helper (`services/projects/access.ts`) used by every
  Projects/Assignments route, so the authorization rule lives in one place.
- **Two serious pre-existing bugs in the original Tasks API found via
  testing and fixed**: `POST /api/tasks` had zero permission checks (any
  authenticated intern could create and assign tasks to anyone, on any
  team), and `GET /api/tasks` returned every task in the org to everyone,
  with no scoping at all. Rewrote both with proper `tasks.create`/
  `tasks.assign` checks and the same team-scoping pattern used for
  Attendance/Timesheets.
- **The task review workflow didn't exist anywhere before this** — the
  517-line Tasks page could only create and list. Built
  `PATCH /api/tasks/[id]` supporting START/SUBMIT/APPROVE/REJECT/REOPEN
  with correct role checks (assignee-only start/submit/reopen,
  reviewer-only approve/reject, mandatory reason on reject), notifications,
  and audit logging, plus a new task detail page to drive it.
- Project progress is computed live from real task counts (verified: 0%
  before a task was approved, 100% immediately after — not a static
  number).
- Daily Updates replaced its fake-stat placeholder with real submit/list,
  one-per-day enforcement, and auto-flagging as late after 7 PM.
- The team-scoping helper (`resolveAttendanceScope`) was generalized to
  accept any permission key, since it's now genuinely shared across
  Attendance, Timesheets, Daily Updates, *and* Projects — verified live
  that a Team Lead sees their own team by default and gets a clean 403
  reaching for another team's project.

## 2. Login by email OR employee ID
Login now accepts either an email address or a permanent employee ID
(`BI-EMP-26-00001`) in the same field — case-insensitive for the ID.
Updated the login API (`identifier` field replacing `email`), the web
login page, and the Flutter login screen/repository to match. Verified
live: same account logs in successfully with its email, with its employee
ID, and with the ID in lowercase.

## 3. Auto-generated emails following the Bharat Infotechs convention
When creating a person with no email specified, the server now generates
one automatically: `firstname@bharatinfotechs.com` for employees/
contractors/freelancers, `firstname@internsbharatinfotechs.com` for
interns/trainees — matching the exact convention requested (e.g. an intern
named Rahul gets `rahul@internsbharatinfotechs.com`). Collisions resolve
by appending a number (`rahul2@...`). A manually-specified email is always
honored instead. Verified live: an intern "Rahul Sharma" got
`rahul@internsbharatinfotechs.com` with zero input, an employee "Rahul
Verma" got the separate `@bharatinfotechs.com` domain (no cross-domain
collision), a third same-named intern correctly resolved to `rahul2@...`,
manual override still works, and duplicate-email rejection still applies
to manually-specified emails.

## Verified live this session (real Postgres, not demo mode)
Project/assignment/task creation wired together correctly; full task
workflow (intern blocked from self-approving, start → submit → the
mandatory-reason-on-reject rule → approve) with live-recomputed project
progress; daily update submission, duplicate-day rejection, and Team-Lead
team-scoped visibility; project cross-team access blocked for a Team Lead
exactly like Attendance/Timesheets; login by email, by employee ID, and by
lowercased employee ID; auto-generated intern vs. employee email domains;
email collision numbering; manual email override; duplicate-email
rejection.

## Not done yet
Phase 5 (Meetings, Google Calendar, Notifications, Email, WhatsApp, Push)
onward, per the priority list at the top of this file. The Flutter app's
own create-person form still requires an email in its UI (the backend and
repository method both now accept omitting it) — left as-is this round to
avoid touching more hand-written, uncompiled Dart than necessary.

---

# Session 4: Phase 5 — Meetings + Google Calendar OAuth

## 1. Meetings (was: 5-line placeholder, schema existed with zero API/UI)
- Full CRUD API: create with participant invites, list (organizer +
  invited participants + anyone with team-view authority over the
  meeting's team, if scoped to one), detail, edit (organizer-only:
  status, notes, agenda, timing).
- Real UI: list with a participant picker in the create flow, detail page
  with organizer-only status control and a notes editor.
- Verified live: an invited participant sees the meeting and receives a
  genuine `MEETING_INVITE` notification (the pre-existing notification
  system, not a new one); a non-organizer participant is correctly
  blocked (403) from changing meeting status; an uninvited outsider with
  no team relationship to the meeting gets a clean 403 both from the list
  endpoint and a direct fetch by ID — the same isolation guarantee now
  covers five modules (Attendance, Timesheets, Daily Updates, Projects,
  Meetings).

## 2. Google Calendar OAuth — completed, not just stubbed
The original codebase had a `/connect` route that redirected to Google's
consent screen, and a `GOOGLE_REDIRECT_URI` pointing at a callback that
**did not exist** — anyone who actually tried to connect would have hit a
dead end. Built the missing half:
- New `google_calendar_connections` table storing tokens **encrypted at
  rest** (AES-256-GCM, `services/integrations/token-crypto.ts`) — access
  and refresh tokens are never stored in plaintext, per the spec's
  "secure OAuth token storage" requirement.
- `/api/integrations/google/callback` — exchanges the authorization code
  for tokens, verifies the `state` param matches the logged-in session
  (so one user's browser can't complete another user's OAuth flow),
  stores the connection, redirects back to Settings with a status
  message.
- `/api/integrations/google/status` and `/disconnect`, plus a real
  Settings → Organization panel to connect/disconnect and see the
  current state.
- Meeting creation now does best-effort Google Calendar sync for
  organizers who've connected their account: creates a calendar event
  with the right time/attendees, stores the returned `googleEventId` on
  the meeting. Critically, a sync failure **never blocks meeting
  creation** — OPDesk's own record is always the source of truth.
- Verified live end-to-end, including a scenario I didn't originally plan
  for: token encryption round-tripped correctly via a direct test; a
  connection with an actually-expired token correctly triggered a refresh
  attempt (not silently skipped); that refresh correctly failed only
  because `oauth2.googleapis.com` isn't reachable from my sandbox's
  network allowlist (a constraint of my dev environment, not the app);
  and the meeting was still created successfully (201) with
  `googleEventId: null` and the failure clearly logged server-side — the
  exact graceful-degradation behavior the design calls for, exercised
  under a more realistic failure path than originally intended.
- Disconnect verified live: status flips from connected to disconnected
  immediately.

## 3. Flutter README: full demo credentials table added
All four seeded accounts (Super Admin/HR/Team Lead/Intern) with email,
employee ID, and password, plus an explanation of the auto-generated
email/ID convention for new people and what changes in `DEMO_MODE=true`.

## 4. Phase 5 status audit (Email / WhatsApp / Push)
Checked what already existed rather than assuming: `sendEmail()` and
`sendWhatsApp()` are real, working service functions from before this
session — not stubs. Push notifications are genuinely unbuilt: the
`.env.example` declares `VAPID_*` variables, but there is no service
worker, no subscription storage, and no `web-push` integration anywhere
in the codebase. This is the one piece of "Phase 5" still at 0%.

## Not done yet
Push notifications (service worker + subscription table + `web-push`
integration). Then Phase 6 (Quality/Performance/Warnings) onward per the
priority list at the top of this file.

---

# Session 5: Push notifications (Phase 5 complete) + welcome emails

## 1. Push notifications — the last piece of Phase 5, built from zero
The `.env.example` declared `VAPID_*` variables but nothing existed behind
them. Built the full stack:
- `web-push` added as a dependency; new `push_subscriptions` table (a user
  can have several — one per browser/device).
- `services/push/push.service.ts`: sends to every device a user has
  subscribed on, gracefully no-ops if unconfigured or the user has no
  subscriptions, and prunes a subscription automatically if the browser
  reports it as revoked (404/410).
- Wired into the **single shared `createNotification()` function** rather
  than scattered call sites — every existing notification type (task
  assigned, meeting invite, task reviewed, etc.) now also attempts a push,
  automatically, with zero changes needed at each call site.
- `public/sw.js` service worker (push + notificationclick handlers),
  client-side subscribe/unsubscribe helpers, VAPID public-key endpoint,
  subscribe/unsubscribe API, and a real Settings → Notifications page
  (replacing another fake-stat placeholder) to turn it on/off.
- **A reliability bug caught and fixed during my own review, before
  testing**: my first draft fired the push send without awaiting it
  ("fire-and-forget"), which is unreliable in serverless deployments —
  the function can freeze immediately after the response is sent, before
  the async work completes. Fixed to await it properly while still
  swallowing errors, so push delivery is attempted within the request
  lifecycle without ever failing the parent operation.
- Verified live with **real** VAPID keys generated via `web-push`'s own
  generator (not placeholders): the public-key endpoint returns
  `configured: true`; a subscription saves and validates correctly;
  creating a task genuinely triggered the push path end-to-end — it
  attempted delivery, hit an expected failure (my hand-typed test key
  isn't cryptographically valid), logged it, and **did not block or fail
  task creation**, which still returned 201. Unsubscribe verified to
  remove the row. Honestly flagged one boundary I couldn't test: the
  404/410 auto-cleanup path needs a real push service response, and
  `fcm.googleapis.com` isn't in my sandbox's network allowlist — same
  category of limitation as the Google Calendar OAuth test earlier.

## 2. Welcome emails — closing the "how does a new employee log in" gap
Creating a person already generated a permanent ID and one-time password,
but the *only* place that password appeared was the admin's screen — if
they didn't manually relay it, the new hire had no way in. Added
`sendWelcomeEmail()`, wired into person creation: on success, an email
goes to the person's (real or auto-generated) address with their
employee ID, login email, temporary password, and a sign-in link,
using the same `sendEmail()` service that already existed (not a new
mail pipeline). The admin's success dialog now says plainly whether the
email actually sent or whether they still need to relay the password
themselves. Verified live: person creation succeeds and returns
`welcomeEmailSent: false` when SMTP isn't configured (expected in this
sandbox — there's no real mail server here), with the service correctly
logging what it *would* have sent instead of throwing — confirming
account creation is never blocked by email delivery either way.

## Phase 5: now complete
Meetings, Google Calendar, Notifications, Email, WhatsApp, and Push are
all real and wired together. Next per the priority list: Phase 6
(Quality Scores, Performance, Warnings).

---

# Session 6: Departments CRUD, admin password reset, and a real bug fix

## 1. Departments — closed a genuine "cannot add departments" gap
Departments were completely read-only: two seeded rows (Technology, HR)
with no create/edit anywhere in the app. Added full CRUD
(`/api/departments`, `/api/departments/[id]`), Super-Admin-gated for
creation/editing, plus a real Settings → Departments page showing each
department's live people/team counts.

## 2. Admin-initiated password reset
Closed a real workflow gap: previously, only the employee themselves
could change their password (Settings → Security); if an admin needed to
reset someone's forgotten password, there was no way to do it. Added
`POST /api/people/[id]/reset-password` (Super Admin only) — generates a
new temporary password, invalidates the old one immediately, emails it to
the person if SMTP is configured, and shows it once to the admin either
way. Wired into the Person detail page. Verified live end-to-end: old
password stops working immediately, new one logs in successfully.

## 3. A real bug found and fixed: correlated-subquery column shadowing
While verifying the new Departments feature, the people/team counts came
back as `0` for departments that definitely had people in them (confirmed
against the database directly). Root cause: `peopleCount` was computed
with a correlated subquery like
`(select count(*) from users where users.department_id = departments.id)`
built via Drizzle's raw `sql` template — Drizzle emitted **unqualified**
column names, so inside the subquery's own scope, `"id"` resolved to
`users.id` (shadowing the outer `departments.id`) instead of the intended
column. The query was silently comparing `users.department_id =
users.id`, which is never true. A sweep of the codebase found the exact
same pattern in the Meetings API's `participantCount` — meaning that
field had been silently wrong since Meetings shipped two sessions ago,
despite meetings themselves having been thoroughly tested (access
control, notifications, Google Calendar sync all worked; nobody had
checked this one specific numeric field). Fixed both by switching to the
`LEFT JOIN ... GROUP BY ... count(distinct child.id)` pattern already
used correctly elsewhere in the codebase (Teams API), which has no
subquery scope to get ambiguous in the first place. Verified live against
raw SQL ground truth: Technology now correctly shows 3 people, HR shows
1, and a meeting created with one participant now correctly shows
`participantCount: 1`. A full sweep confirmed no other correlated
subqueries exist anywhere else in the codebase.

## On "the app has nothing, make it like the webapp"
Confirmed with the person that this referred to the **Flutter mobile
app**, not the web app — the web app already has all of the above and
everything from prior sessions. The Flutter app currently covers Login,
Dashboard, People, Teams, and Roles & Permissions; it doesn't yet have
Attendance, Tasks, Meetings, Timesheets, Daily Updates, Projects, or
Notifications screens. Extending it is the agreed next priority.

## Also requested, explicitly flagged as new/larger scope rather than silently attempted
A real-time chat feature (group and individual messaging, "spaces") was
requested. This is a substantial new feature not in the original
specification — it needs its own data model, real-time delivery
(websockets or polling infrastructure), and UI, on top of everything
else. Flagging it here rather than half-building it badly; it should be
scoped as its own dedicated effort.






## Development checkpoint — management, communication and audit hardening

- Added first-class MANAGER role to the database enum, permission catalog, role settings and people validation.
- Added manager-scoped workforce/task/dashboard access through direct-report relationships.
- Added REJECTED warning status so rejected warning requests remain in permanent audit history instead of being deleted.
- Expanded warning approval chain to recognize MANAGER as an approver.
- Hardened group/space/direct chat creation so members must belong to the same active organization and DIRECT conversations require exactly two people.
- Added in-app/push notification fan-out for new chat messages.
- Added manager role visibility to relevant web/mobile role controls.
- Added production mobile API URL guidance.

## Block 8 — Employee 360° Action Center
- Added `/management/[id]` Employee 360° control page.
- Added manager actions for daily-update review and pending leave decisions.
- Added performance scoring shortcut from Employee 360°.
- Surfaced tasks, updates, leave, warnings, quality, attendance and employee metrics in one operational view.
- Added database indexes for common Employee 360° queries.
- Existing role/scope enforcement remains server-side through management APIs.
