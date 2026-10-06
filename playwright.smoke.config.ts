import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke test against the LOCAL Supabase stack (seed users from
 * supabase/seed.sql). Not for production.
 *
 * From the repo root, with the local stack running (`supabase start`):
 *
 *   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
 *   SMOKE_PORT=3201 \
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \
 *   SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *   NEXT_PUBLIC_APP_URL=http://localhost:3201 \
 *   npm run test:smoke    (= npx playwright test -c playwright.smoke.config.ts)
 *
 * SMOKE_PORT       port for the app (default 3201)
 * SMOKE_PASSWORD   seed user password (default: the one in supabase/seed.sql)
 *
 * An app already listening on SMOKE_PORT is reused; otherwise `next dev` is
 * started. It has to be dev: the production CSP (next.config.mjs) only allows
 * *.supabase.co, so a production build cannot talk to the local stack.
 */
const port = Number(process.env.SMOKE_PORT ?? 3201)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
    },
  },
})
