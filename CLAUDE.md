# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build production bundle
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run test         # Run unit tests (Vitest)
npm run test:ui      # Run tests with UI dashboard
npm run test:coverage # Run tests with coverage report
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:ui  # Run E2E tests with UI mode
npm run db:generate  # Generate TypeScript types from Supabase schema
npm run db:migrate   # Push database migrations to Supabase

# Run a single test file
npx vitest path/to/file.test.ts

# Run tests matching a pattern
npx vitest -t "test name pattern"
```

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **UI**: Tailwind CSS, shadcn/ui (New York style), Radix UI primitives
- **State**: Zustand (client state), TanStack React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Database**: Supabase (PostgreSQL with RLS policies)
- **Testing**: Vitest (unit), Playwright (E2E)

## Architecture

```
/app
  /(auth)              # Public auth routes (login, signup, password reset, email verification)
  /(dashboard)         # Protected routes with Header layout
    /dashboard         # Main dashboard with PGA metrics
    /reports           # Reports listing
    /reports/[date]    # Individual report detail/edit page
    /locations         # Location management (CRUD)
    /team              # Team management (members, invitations)
    /settings          # User settings (profile, password, appearance)
  /api                 # API routes (auth, team CRUD, invitations)

/components
  /ui                  # shadcn/ui components (button, dialog, form, etc.)
  /providers           # Context providers (Query, Theme, Toast)

/hooks                 # Custom React Query hooks for data fetching/mutations
/lib
  /supabase            # Supabase clients (client, server, admin, middleware)
  /validations         # Zod schemas for forms
/stores                # Zustand stores (sidebar state, theme persistence)
/supabase/migrations   # SQL migration files
/types                 # TypeScript types (auto-generated Supabase types + app types)
/tests
  /unit                # Vitest unit tests
  /e2e                 # Playwright E2E tests
```

## Key Patterns

**Data Fetching**: Custom hooks wrap React Query. Hooks return `{ data, isLoading, isPending, error }`. Mutations use `useMutation` with automatic query invalidation.

**Authentication**: Middleware refreshes sessions on all requests. Server and browser Supabase clients are separated for SSR support. RLS policies enforce data access.

**Role-Based Access**: Four user roles exist: `admin`, `manager`, `fob_leader`, `pastor`. Use `useUserRole()` hook to check permissions. Use `useUserAssignment()` to get full assignment details including FOB/location. Some UI elements are conditionally rendered based on role.

**Components**: Server Components by default; mark Client Components with `'use client'`. UI components use composition patterns from shadcn/ui.

**Styling**: Tailwind with HSL color variables. Dark mode via class-based toggle. Path alias `@/` for imports from root.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

## Database

Supabase types are auto-generated at `/types/supabase.ts`. Run `npm run db:generate` after schema changes. Migrations live in `/supabase/migrations`.

**Core Tables**: `profiles`, `roles`, `user_assignments`, `fobs`, `locations`, `pga_reports`, `pga_entries`, `team_invitations`

**Domain Model**: Users are assigned roles via `user_assignments`. FOB Leaders manage FOBs (districts), Pastors manage individual locations within FOBs. PGA reports contain entries per location with metrics (sv1, sv2, yxp, kids, local, hc1, hc2).

## Git

- Do NOT add `Co-Authored-By` lines to commit messages.
