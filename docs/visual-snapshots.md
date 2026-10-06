# Visual snapshots

`scripts/visual-snapshots.mjs` captures full-page screenshots of every page for every
role, in light and dark theme, at desktop (1440x900) and mobile (390x844), and compares
two capture sets. Use it to check upgrades (e.g. Tailwind 3 -> 4) for visual regressions.

## Capture

Run against a **production build** pointed at the **local Supabase stack** (seed data
from `supabase/seed.sql`). Never point it at production.

```bash
# keys for the local stack
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \
       SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY NEXT_PUBLIC_APP_URL=http://localhost:3202

npm run build
npx next start -p 3202 &
npx playwright install chromium   # once

node scripts/visual-snapshots.mjs capture http://localhost:3202 /path/to/out
```

Options: `--roles=loggedout,admin,manager,leader,pastor`, `--themes=light,dark`,
`--viewports=desktop,mobile`, `--only=<slug substring>`, `--concurrency=4`.
Env: `VS_PASSWORD` (default `password123`), `VS_EMAIL_<ROLE>` to override a login.

Output: `<role>__<theme>__<viewport>__<slug>.png` plus `manifest.json`
(role, route, theme, viewport, file for each capture, and any failures).

What is captured:

- logged out: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- every signed-in role: dashboard, reports (+ each report tab), report detail pages for
  2026-10-04 / 2026-08-30, 4-week PGA/EPGA, EPGA, salvation, mechanics, trends, compare,
  settings (profile/password/appearance); plus `/locations` (admin, manager, leader),
  `/team` (admin, manager), `/activity` (admin)
- admin only: Record PGA dialog, report row-actions menu, Edit PGA dialog, header user
  menu, Activity "Deleted" tab, Locations with "Archived" toggle on

## Compare

```bash
node scripts/visual-snapshots.mjs compare <baselineDir> <candidateDir> <reportDir>
open <reportDir>/index.html
```

Writes `index.html` (baseline / candidate / diff side by side, sorted by % pixels
changed), `summary.json` and `diffs/*.png`. Under 0.1% changed pixels (and same size)
counts as identical (`--threshold=<percent>` to change). Exits 1 if anything differs.

## Determinism

- Login once per role through the real `/login` form; the session is reused for all
  theme/viewport variants. `/api/auth/login` is rate limited to **5 attempts / 15 min per
  IP, in memory**: a full run uses 4, so restart `next start` between runs (or wait).
- Theme is set via the persisted zustand key `theme-storage` before any page script runs.
- Clock: an init script shifts `Date` so "now" starts at 2026-10-06T09:00:00+03:00 and
  keeps ticking; timezone Africa/Nairobi, locale en-US. Playwright's `page.clock` is not
  used: `install()` also fakes `performance.now()`, which desyncs framer-motion's Web
  Animations from `document.timeline` after the first navigation (they never finish),
  and `setFixedTime()` made staggered entrance animations flaky.
- CSS animations/transitions are disabled; the script waits for network idle, skeletons /
  spinners to disappear and Web Animations (framer-motion) to finish, parks the mouse at
  (0,0) and takes screenshots until three consecutive frames are byte-identical.
- `bypassCSP` is on because the production CSP only allows `*.supabase.co`, not the local
  stack; it has no visual effect.
- The local DB is shared: if someone edits seed data between baseline and candidate runs,
  data-driven pages will differ. Re-capture the baseline from `main` if in doubt.
