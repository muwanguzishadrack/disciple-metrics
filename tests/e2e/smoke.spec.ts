import { test, expect, type Page } from '@playwright/test'

/**
 * Whole-app smoke test against the LOCAL Supabase stack. Run it with
 * playwright.smoke.config.ts (see that file for the command and env vars).
 *
 * Read-only: dialogs are opened and dismissed, nothing is submitted. Logout is
 * exercised with the sign-out request narrowed to scope=local so it cannot
 * revoke other sessions of the shared seed users.
 */

const PASSWORD = process.env.SMOKE_PASSWORD ?? 'password123'
const REPORT_DATE = process.env.SMOKE_REPORT_DATE ?? '2026-10-04'

type Role = 'admin' | 'manager' | 'fob_leader' | 'pastor'

const USERS: Record<Role, string> = {
  admin: 'admin@test.local',
  manager: 'manager@test.local',
  fob_leader: 'leader@test.local',
  pastor: 'pastor@test.local',
}

const REPORT_ROUTES = [
  '/reports',
  `/reports/${REPORT_DATE}`,
  `/reports/epga/${REPORT_DATE}`,
  `/reports/mechanics/${REPORT_DATE}`,
  `/reports/salvation/${REPORT_DATE}`,
  `/reports/4-week-pga/${REPORT_DATE}`,
  `/reports/4-week-epga/${REPORT_DATE}`,
  '/reports/trends',
  '/reports/compare',
]

const SETTINGS_ROUTES = [
  '/settings',
  '/settings/profile',
  '/settings/password',
  '/settings/appearance',
]

// Routes each role can reach from the nav (components/layout/header.tsx).
const ROUTES: Record<Role, string[]> = {
  admin: ['/dashboard', ...REPORT_ROUTES, '/locations', '/team', '/activity', ...SETTINGS_ROUTES],
  manager: ['/dashboard', ...REPORT_ROUTES, '/locations', '/team', ...SETTINGS_ROUTES],
  fob_leader: ['/dashboard', ...REPORT_ROUTES, '/locations', ...SETTINGS_ROUTES],
  pastor: ['/dashboard', ...REPORT_ROUTES, ...SETTINGS_ROUTES],
}

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']

/** Collects uncaught errors, console errors and failed requests for a page. */
function watch(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // A 4xx resource load is logged by the browser as a console error; the
    // response itself is checked below, where 4xx is allowed.
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return
    problems.push(`console.error: ${text}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 500) problems.push(`HTTP ${res.status()}: ${res.request().method()} ${res.url()}`)
  })
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? ''
    // Cancelled prefetches / superseded navigations are not failures.
    if (failure.includes('ERR_ABORTED') || failure.includes('NS_BINDING_ABORTED')) return
    problems.push(`requestfailed: ${req.method()} ${req.url()} ${failure}`)
  })
  return problems
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error/)
}

async function visit(page: Page, path: string) {
  const res = await page.goto(path)
  expect(res, `no response for ${path}`).not.toBeNull()
  expect(res!.status(), `status for ${path}`).toBeLessThan(400)
  await settle(page)
}

async function login(page: Page, role: Role) {
  // /api/auth/login rate-limits per client IP (5 per 15 min, in memory).
  // Give each login its own synthetic IP so repeated runs are not throttled.
  await page.route('**/api/auth/login', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-forwarded-for': `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
    })
  )
  await page.goto('/login')
  await settle(page)
  const email = page.getByLabel('Email')
  // The password label targets the input's wrapper (show/hide toggle), so use the placeholder.
  const password = page.getByPlaceholder('Enter your password')
  // Text typed before hydration finishes can be reset by React; refill until it sticks.
  await expect(async () => {
    await email.fill(USERS[role])
    await password.fill(PASSWORD)
    await expect(email).toHaveValue(USERS[role], { timeout: 1_000 })
    await expect(password).toHaveValue(PASSWORD, { timeout: 1_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/dashboard', { timeout: 60_000 })
  await settle(page)
}

test.describe('logged out', () => {
  for (const path of AUTH_ROUTES) {
    test(`auth page ${path} renders`, async ({ page }) => {
      const problems = watch(page)
      await visit(page, path)
      await expect(page.getByRole('heading').first()).toBeVisible()
      expect(problems, problems.join('\n')).toEqual([])
    })
  }

  test('/dashboard redirects to /login', async ({ page }) => {
    const problems = watch(page)
    await page.goto('/dashboard')
    await page.waitForURL('**/login')
    await settle(page)
    expect(problems, problems.join('\n')).toEqual([])
  })
})

for (const role of Object.keys(USERS) as Role[]) {
  test(`${role}: every page, dialogs, export, logout`, async ({ page }) => {
    const problems = watch(page)
    await login(page, role)

    for (const path of ROUTES[role]) {
      await test.step(`visit ${path}`, async () => {
        await visit(page, path)
        expect(problems, `${path}\n${problems.join('\n')}`).toEqual([])
      })
    }

    await test.step('open and dismiss Record PGA', async () => {
      await visit(page, '/dashboard')
      await page.getByRole('button', { name: 'Record PGA' }).click()
      const dialog = page.getByRole('dialog', { name: 'Record PGA' })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    })

    await test.step('Excel export downloads a file', async () => {
      await visit(page, `/reports/${REPORT_DATE}`)
      const exportButton = page.getByRole('button', { name: 'Export' })
      await expect(exportButton).toBeEnabled()
      const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()])
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
    })

    if (role === 'admin' || role === 'manager' || role === 'fob_leader') {
      await test.step('open and dismiss an entry edit dialog', async () => {
        // Still on /reports/<date>. Admins can always edit; for others the
        // report may be past the edit lock, in which case rows show "Locked".
        const actionButtons = page.locator('tbody tr td:last-child button')
        if (role === 'admin') await expect(actionButtons.first()).toBeVisible()
        if ((await actionButtons.count()) === 0) {
          console.log(`[smoke] ${role}: no editable entries on ${REPORT_DATE}, edit dialog step skipped`)
          test.info().annotations.push({ type: 'skip', description: `${role}: no editable entries on ${REPORT_DATE}` })
          return
        }
        await actionButtons.first().click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        const dialog = page.getByRole('dialog', { name: 'Edit PGA' })
        await expect(dialog).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
      })
    }

    await test.step('logout', async () => {
      await page.route('**/auth/v1/logout**', (route) => {
        const url = new URL(route.request().url())
        url.searchParams.set('scope', 'local')
        return route.continue({ url: url.toString() })
      })
      await page.locator('header button:has(svg.lucide-chevron-down)').last().click()
      await page.getByRole('menuitem', { name: 'Sign out' }).click()
      await page.waitForURL('**/login')
      await settle(page)
    })

    expect(problems, problems.join('\n')).toEqual([])
  })
}
