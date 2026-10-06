# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Build production bundle (Turbopack)
npm run lint         # ESLint 9 flat config (eslint.config.mjs) over app/ components/ lib/
npm run format       # Format code with Prettier
npm run test         # Run unit tests (Vitest)
npm run test:ui      # Run tests with UI dashboard
npm run test:coverage # Run tests with coverage report
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:ui  # Run E2E tests with UI mode
npm run test:smoke   # Playwright smoke test against the local Supabase stack (see playwright.smoke.config.ts)
npm run db:generate  # Generate TypeScript types from Supabase schema
npm run db:migrate   # Push database migrations to Supabase (CLI must be linked)

# Run a single test file
npx vitest path/to/file.test.ts

# Run tests matching a pattern
npx vitest -t "test name pattern"

# Local database (Docker): rebuild from migrations + seed, then run pgTAP tests
supabase start && supabase db reset && supabase test db

# Visual regression: capture every page/role/theme/viewport, then compare (docs/visual-snapshots.md)
node scripts/visual-snapshots.mjs capture <baseUrl> <outDir>
node scripts/visual-snapshots.mjs compare <baselineDir> <candidateDir> <reportDir>

# First-load JS per route (gzip KB) from the last build
node scripts/route-js-size.mjs
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack) with React 19 and TypeScript 5.9
- **UI**: Tailwind CSS 4 (CSS-first config in `app/globals.css`, no `tailwind.config.ts`), shadcn/ui (New York style), Radix UI primitives, `motion` for animations, lucide-react icons
- **State**: Zustand 5 (client state), TanStack React Query 5 (server state)
- **Forms**: React Hook Form + Zod 3 validation
- **Charts / export**: Recharts 3 (Trends page), SheetJS `xlsx` 0.20 from the SheetJS CDN (Excel export, loaded on demand)
- **Database**: Supabase (PostgreSQL with RLS policies), `@supabase/ssr` 0.12
- **Testing**: Vitest 5 (unit), Playwright (E2E + smoke + visual snapshots), pgTAP (`supabase/tests/database`)
- **Hosting**: Vercel (auto-deploys `main`), with Vercel Speed Insights in production

### Deliberate version pins (re-check before "fixing")

- `@radix-ui/react-tabs` 1.1.13: newer versions focus tabs on mousedown, which shows a focus ring on clicked report tabs.
- `@tanstack/react-query-devtools` 5.102.8: newer versions pull in a package with a critical advisory.
- `zod` 3.25: zod 4 adds ~21 KB gzip to every form page.
- TypeScript 5.9 (not 7) and ESLint 9 (eslint-config-next's plugins don't support 10 yet).

## Architecture

```
/proxy.ts              # Next 16 "proxy" (formerly middleware): session refresh + auth redirects, Node.js runtime
/app
  /(auth)              # Public auth routes (login, signup, password reset, email verification)
  /(dashboard)         # Protected routes with Header layout
    /dashboard         # Main dashboard with PGA metrics + missing-entries card
    /reports           # Report tabs (PGA, 4-week, EPGA, Salvation, Mechanics)
    /reports/[date]    # Individual report detail/edit page (also epga/, salvation/, mechanics/, 4-week-*/ subroutes)
    /reports/trends    # Weekly trend charts by region/FOB/location
    /reports/compare   # Period totals (YTD etc.) with deltas + Excel export
    /activity          # Admin only: change history + restore deleted reports/entries
    /locations         # Location management (archive/restore, no hard delete)
    /team              # Team management (members, invitations)
    /settings          # User settings (profile, password, appearance)
  /api                 # API routes (auth, team CRUD, invitations)

/components
  /ui                  # shadcn/ui components (button, dialog, form, etc.)
  /pga                 # Shared PGA metric form fields, outlier/lock/missing-entries logic
  /analytics           # Trends + Compare views and pure period/metric helpers
  /activity            # Change log + deleted items tabs
  /reports             # Report tab components
  /providers           # Context providers (Query, Theme, Toast)

/hooks                 # Custom React Query hooks for data fetching/mutations
/lib
  /supabase            # Supabase clients (client, server, admin) + session logic used by proxy.ts (middleware.ts)
  /validations         # Zod schemas for forms (PGA_METRICS in pga.ts drives both PGA dialogs)
  export.ts            # Excel export (imports xlsx lazily)
/stores                # Zustand stores (sidebar state, theme persistence)
/supabase
  /migrations          # SQL migrations; 20261004000000 is the full baseline of the production schema
  /migrations_archive  # Pre-baseline migrations (history only, never applied again)
  /tests/database      # pgTAP tests
  seed.sql             # Local-only seed data and *@test.local users
/types                 # TypeScript types (auto-generated Supabase types + app types)
/docs/database         # ROLLOUT, MIGRATIONS (history + rules), BACKUPS runbooks
/tests
  /unit                # Vitest unit tests
  /e2e                 # Playwright E2E + smoke tests
```

## Key Patterns

**Data Fetching**: Custom hooks wrap React Query. Hooks return `{ data, isLoading, isPending, error }`. Mutations use `useMutation` with automatic query invalidation.

**Authentication**: `proxy.ts` (via `lib/supabase/middleware.ts`) refreshes sessions on matching requests. Its `getUser()` call is bounded to 3s and fails open; this prevented the Aug 2026 504s, so keep the bound, the fail-open behaviour and the matcher exclusions. Server and browser Supabase clients are separated for SSR support. RLS policies are the security boundary.

**Next 16 request APIs**: `cookies()`, `headers()`, `params` and `searchParams` are async and must be awaited.

**Role-Based Access**: Four user roles exist: `admin`, `manager`, `fob_leader`, `pastor`. Use `useUserRole()` hook to check permissions. Use `useUserAssignment()` to get full assignment details including FOB/location. Some UI elements are conditionally rendered based on role; the data itself is scoped by RLS (pastor: own location, fob_leader: own FOB, admin/manager: everything).

**Components**: Server Components by default; mark Client Components with `'use client'`. UI components use composition patterns from shadcn/ui. Heavy client-only pieces (recharts, the date-picker calendar, xlsx) are loaded on demand.

**Styling**: Tailwind 4 with HSL color variables defined in `app/globals.css` (`@theme inline`). Dark mode via class-based toggle (`@custom-variant dark`). `globals.css` contains deliberate Tailwind-3 parity rules (colors, `space-*`, borders, placeholder, cursor, hover); don't remove them without a visual-snapshot comparison. Path alias `@/` for imports from root.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

To run against the local Supabase stack, override these on the command line from `supabase status -o env` (don't edit `.env.local`). The production CSP only allows `*.supabase.co`; the local stack is allowed in development only.

## Database

Production project ref: `jnrgdalmqcspnsgueroc`. Supabase types are auto-generated at `/types/supabase.ts`. Run `npm run db:generate` after schema changes. New migrations go in `/supabase/migrations` with a version after the latest file. They must be additive and backwards compatible (the database ships before the app), start with `set lock_timeout = '5s';`, and come with pgTAP tests. Production's migration history matches the repo files, so `supabase db push` works once the CLI is linked.

**Core Tables**: `profiles`, `roles`, `user_assignments`, `regions`, `fobs`, `locations`, `pga_reports`, `pga_entries`, `user_invitations`, `audit_logs` (auth/team events), `pga_change_log` (every insert/update/delete of reports and entries, written by triggers), `app_settings` (e.g. `pga_edit_lock_days`)

**Domain Model**: Regions contain FOBs (districts); FOB Leaders manage FOBs, Pastors manage individual locations within FOBs. Users are assigned roles via `user_assignments`. PGA reports (one per Sunday, created by a pg_cron job) contain one entry per location with metrics: sv1, sv2, yxp, kids, local, hc1, hc2, mca, baptisms, salvation categories, mechanics_get/worship/training/mechanics.

**Rules that are easy to break**:
- `pga_entries.salvations` is a GENERATED column; never write it.
- `pga_entries.fob_id` / `region_id` are frozen snapshots; group by them, never re-derive from the location.
- Deletes are recoverable through `pga_change_log` + the admin-only `restore_pga_*` RPCs, so there is no `deleted_at` column.
- Non-admins can't change entries on reports older than `pga_edit_lock_days` (DB trigger, error `PGA_ENTRY_LOCKED:`).
- Metric columns have CHECK range constraints (`pga_entries_<col>_range`, error 23514).
- Locations are archived (`archived_at`), never deleted from the app.

## Git

- Do NOT add `Co-Authored-By` lines to commit messages.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
