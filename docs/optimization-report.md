# Optimization Report — Disciple Metrics

> Generated 2026-07-11 from a full audit of the codebase (data fetching, rendering/bundle,
> API routes/middleware), the Supabase performance advisors, and a production build.

**Verdict: there is real room to optimize.** The app is functionally healthy — aggregations
are correctly done in Postgres views/RPCs, there are no N+1 queries, and the API routes use
proper nested selects — but it carries significant avoidable weight in three areas:
**first-load JavaScript, redundant auth round-trips, and unbounded client-side data fetching**.
Nothing is on fire at today's scale (~6k report entries, ~255 users), but several of these
get worse every week as data grows.

## Current numbers

From a production build (2026-07-11):

| Route | First Load JS |
| --- | --- |
| `/reports/[date]` | 358 kB |
| `/reports` | 346 kB |
| `/reports/4-week-epga/[date]`, `/reports/4-week-pga/[date]` | 344 kB |
| `/reports/salvation/[date]` | 337 kB |
| `/reports/epga/[date]` | 336 kB |
| `/dashboard` | 295 kB |
| Middleware bundle | 72.7 kB |

For a form-and-tables app, a healthy target is under ~200 kB — the most-visited pages carry
roughly 150 kB of unnecessary code.

Database scale at time of audit: `pga_entries` 5,918 rows / 1.8 MB, `audit_logs` 4,286 rows,
`profiles` 255, `locations` 234, `fobs` 35, `pga_reports` 27.

---

## Tier 1 — Quick wins (high impact, under an hour each)

### 1. `xlsx` (~400 kB) is bundled into page load on ten routes

`lib/export.ts:1` does `import * as XLSX from 'xlsx'` at the top level, and that file is
imported by all five report tabs and all five report detail pages — so the whole spreadsheet
library downloads and parses on page load, even though it only runs when someone clicks
Export. Change `exportToExcel` to `const XLSX = await import('xlsx')` inside the function to
move it to an on-demand chunk (callers become `async`). This is the single biggest bundle win.

### 2. React Query Devtools ships to production

`components/providers/query-provider.tsx:4` imports and renders `ReactQueryDevtools`
unconditionally, so every user downloads dev tooling. Gate it behind
`process.env.NODE_ENV === 'development'`.

### 3. No build optimizations in `next.config.mjs`

Add `experimental.optimizePackageImports: ['lucide-react', 'date-fns']` to improve
tree-shaking of the ~20-icon import lists spread across pages. One-line change.

### 4. Broken cache-invalidation key (correctness bug)

`hooks/use-locations.ts:103` invalidates `['pga-reports']` — a key no query uses. Deleting a
location deletes its entries, but every report summary stays stale in the UI. The correct
helper `invalidateAllPgaQueries` already exists in `hooks/use-pga.ts:553` — call it instead.

### 5. Audit-log writes block every response

Every login, signup, invite, and team change `await`s a Supabase insert into `audit_logs`
before responding (`lib/audit-log.ts:34-70`). The user waits on a write they never see. Use
`waitUntil()` (Vercel) so it runs after the response, with a `.catch()`.

---

## Tier 2 — Auth and middleware round-trips (high impact, moderate effort)

### 6. Middleware validates the session over the network on nearly every request

The matcher in `middleware.ts` only excludes static/image paths, so all pages, all `/api/**`
routes, and public assets pass through `updateSession()`, which calls
`supabase.auth.getUser()` — a network round-trip to Supabase Auth, adding 50–200 ms each
time. Every API route then calls `getUser()` again itself, so a typical API call pays for two
auth validations.

Fixes:

- Exclude `/api` and common static file extensions from the matcher.
- Use local JWT verification (`getClaims()` / `getSession()`) in middleware where only "is
  there a valid session" is needed; keep the authoritative `getUser()` inside route handlers.

### 7. User → role fetch waterfall on every page

`useUser` (`hooks/use-user.ts:9`) does a network `getUser()`, and only after it resolves do
`useUserRole`, `useUserAssignment`, and `useProfile` fire. `useUserRole` (an RPC) duplicates
data `useUserAssignment` already returns — the header uses both simultaneously, so the role
is fetched twice under different query keys. Derive the role from `useUserAssignment` and
delete the RPC call; longer-term, resolve user + role in the server layout and hydrate React
Query.

### 8. The in-memory rate limiter doesn't work in production

`lib/rate-limit.ts` uses a module-scope `Map` plus `setInterval`. On serverless, each
instance has its own memory, so "5 logins per 15 minutes" is really 5 × N instances, and
counters vanish on cold starts. It also trusts the first `x-forwarded-for` hop, which is
client-spoofable. Move to a shared store (Upstash Redis / `@upstash/ratelimit`) or
platform-level WAF rules.

---

## Tier 3 — Data fetching (grows worse with scale)

### 9. Report queries are unbounded

`usePgaReports` (`hooks/use-pga.ts:214`) fetches every row of `pga_report_summary` for all
time with `select('*')`, then the tabs filter by date and paginate in JavaScript. The same
pattern repeats in all five summary hooks. Push the date filter and pagination into the query
(`.gte`/`.lte`/`.range()`, with `count: 'exact'` for the pagination UI).

### 10. The same view is fetched three times

`usePgaReports`, `useEpgaSummary`, and `useSalvationSummary` all read `pga_report_summary`
under three different query keys, so React Query never dedupes them — switching report tabs
re-downloads overlapping data. Fetch once under one key and derive the tab shapes with React
Query's `select` option.

### 11. The Salvation detail over-fetches

`useSalvationReport` reuses the full report query (all ~15 metric columns plus two levels of
joins) and discards everything except four salvation columns. EPGA and 4-week views already
have purpose-built RPCs — add a matching `get_salvation_detail(p_date)` RPC.

### 12. Sequential calls that could be parallel

`useCreatePgaEntry` is three serialized round-trips (check report → insert report → insert
entry) with a race condition if two users submit the same date; an upsert or single RPC fixes
both. Similar serial-instead-of-`Promise.all` patterns exist in
`app/api/team/invite/route.ts:56-90`, `app/api/team/[id]/route.ts:29-40`, and the
signup/accept-invitation routes.

---

## Tier 4 — Database (from Supabase advisors)

### 13. Every RLS policy re-evaluates `auth.uid()` per row

All ~30 policies across `profiles`, `pga_entries`, `locations`, `fobs`, `user_assignments`,
and `user_invitations` trigger the `auth_rls_initplan` warning. Wrapping calls as
`(select auth.uid())` makes Postgres evaluate once per query instead of once per row. Minor
at 6k rows; real at 100k. Mechanical find-and-replace migration.

### 14. Duplicate permissive policies

On `profiles` and `user_assignments` (e.g. "Admins can view all" + "Users can view own" both
run on every SELECT). Merge each pair into one policy with an `OR`.

### 15. Four unindexed foreign keys on `user_invitations`

`fob_id`, `location_id`, `role_id`, `invited_by` — cheap to add, matters for the join-heavy
invitation queries. Also two unused indexes on `audit_logs` (`idx_audit_logs_action`,
`idx_audit_logs_created_at`) that could be dropped.

---

## Tier 5 — Rendering polish (lower priority)

- **`framer-motion` (~40–60 kB) is in nearly every route bundle** for simple fade/slide-in
  effects that `tailwindcss-animate` (already installed) can do in CSS. Keep it only for the
  mobile-nav drawer, ideally via `LazyMotion`.
- **Every dashboard page is fully `'use client'`** with no `loading.tsx` anywhere, so
  navigation shows nothing until JS hydrates and queries resolve. Adding `loading.tsx`
  skeletons per segment is a cheap UX win; converting pages to server shells with client
  leaves is the bigger (optional) refactor.
- **The five report tabs re-run date filtering on every render** without `useMemo`, calling
  `getDateRange()` once per row inside the filter callback (e.g.
  `components/reports/pga-reports-tab.tsx:109-116`) — inconsistent with the dashboard, which
  memoizes correctly.
- **`overlayscrollbars` loads globally** just to restyle the scrollbar; CSS `scrollbar-*`
  utilities could replace it.
- Minor cleanup: unused Geist font files in `app/fonts/`, stale Google Fonts entries in the
  CSP, and duplicated invitation-acceptance logic between `app/api/auth/callback` and
  `app/api/auth/accept-invitation` where the callback path can violate the
  `valid_assignment` DB constraint.

---

## Risk assessment — will these break production?

Most won't; four need real care.

### Safe to ship anytime (effectively zero risk)

- **#1 lazy `xlsx`** — behavior-identical; only visible change is a sub-second delay the
  first time Export is clicked while the chunk downloads.
- **#2 devtools gating** — removes code that shouldn't be in production; nothing depends on it.
- **#3 `optimizePackageImports`** — build-time only. If `npm run build` passes, done.
- **#4 invalidation key fix** — fixes a production bug; only effect is extra refetches.
- **#15 foreign-key indexes** — indexes don't change query results; tables are tiny so the
  creation lock is milliseconds.
- **Tier 5 items** (`loading.tsx`, `useMemo`, dead font cleanup) — additive or purely internal.

### Low risk, one thing to verify each

- **#5 non-blocking audit logs** — on serverless, dropping the `await` without `waitUntil()`
  can lose log writes when the function freezes after responding. Use `waitUntil()`. Accepted
  trade-off: audit logging becomes best-effort rather than transactional.
- **#7 role waterfall** — deriving the role from `useUserAssignment` assumes every user,
  including admins, has a `user_assignments` row. Verify in the data before deleting the
  `get_user_role` RPC. Swapping `getUser()` for `getSession()` for UI gating is safe because
  RLS still enforces access server-side.
- **#8 rate limiter** — make the new limiter fail-open (if Redis is unreachable, allow the
  request); fail-closed misconfiguration would block all logins. The current limiter barely
  works in production anyway.
- **#11 salvation RPC** — copy the `get_epga_detail` pattern exactly so it inherits the same
  access semantics.
- **#12 upsert** — confirm `pga_reports.date` has a unique constraint first; upsert without
  it silently inserts duplicates.

### The four that need genuine care

**#6 middleware changes — highest risk on the list.** Two traps:

1. The middleware isn't just an auth check — `updateSession()` also refreshes expired tokens
   and rewrites session cookies. Excluding `/api` and static assets is safe (API routes
   refresh via their own `getUser()`); excluding app pages is where it can bite — a user
   sitting on a page past token expiry can end up with a dead session.
2. `getClaims()` only verifies locally if the Supabase project uses the new asymmetric JWT
   signing keys; on legacy HS256 it still round-trips, and `@supabase/ssr` 0.5.2 predates
   good support for it. That half is really "upgrade supabase-js/ssr + migrate JWT signing
   keys in the dashboard" — a proper migration. Do the matcher narrowing first (safe, most of
   the win) and treat `getClaims` as a separate follow-up.

**#9 server-side pagination — biggest client refactor.** The dashboard's range totals are
computed by reducing the full fetched dataset; once only a page is fetched, those totals
silently become wrong unless a totals RPC ships at the same time. Same for
`filteredReports.length` driving pagination UI (needs the `count: 'exact'` swap). It won't
error — it will show wrong numbers. Ship as one coherent change with the RPC and verify
dashboard stats against known values.

**#13 RLS `(select auth.uid())`** — semantically identical when done right, but it edits ~30
security policies; a typo doesn't throw, it either locks users out or over-grants access. Do
it in a Supabase branch and test one login per role (admin, manager, fob_leader, pastor)
before merging.

**#14 merging permissive policies** — rewriting access logic into `OR` conditions; a wrong
boolean means admins lose visibility or regular users gain it. Same branch-and-test-per-role
routine.

### Recommended rollout order

1. Ship the zero-risk batch (#1–4, #15) in one deploy — measurable win, nothing to test
   beyond a build and a click-through.
2. For the database changes (#13, #14), use a Supabase branch, apply the migration there, and
   smoke-test each of the four roles before pushing to production.
3. For #6, narrow the matcher only (keep `getUser()` in middleware for pages), deploy, watch
   for login/redirect issues for a few days, then consider the JWT-keys migration separately.
4. Do #9 last, paired with the totals RPC, and verify dashboard numbers match pre-change
   values for the same date range.

The Playwright E2E tests (auth, settings) cover exactly the flows the middleware and
pagination changes touch — run them against a preview deployment for those.
