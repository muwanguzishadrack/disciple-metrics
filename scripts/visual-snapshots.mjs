#!/usr/bin/env node
/**
 * Visual snapshot capture + compare for DiscipleMetrics.
 *
 * Capture (run against a PRODUCTION build: `npm run build && npx next start -p <port>`,
 * pointed at the local Supabase stack with its seed data):
 *
 *   node scripts/visual-snapshots.mjs capture <baseUrl> <outDir> [options]
 *
 *   options
 *     --roles=loggedout,admin,manager,leader,pastor   subset of roles (default: all)
 *     --themes=light,dark                             (default: both)
 *     --viewports=desktop,mobile                      (default: both)
 *     --only=<substring>                              only captures whose slug contains it
 *     --concurrency=4                                 parallel browser contexts
 *
 *   env
 *     VS_PASSWORD   password of the seeded test users (default: password123, see supabase/seed.sql)
 *     VS_EMAIL_<ROLE>  override a role's login email (e.g. VS_EMAIL_ADMIN)
 *
 *   Output: <role>__<theme>__<viewport>__<slug>.png + manifest.json in <outDir>.
 *
 * Compare:
 *
 *   node scripts/visual-snapshots.mjs compare <baselineDir> <candidateDir> <reportDir> [--threshold=0.1]
 *
 *   Writes <reportDir>/index.html (side by side + diff, sorted by % pixels changed),
 *   <reportDir>/summary.json and diff PNGs. Captures under the threshold (percent of
 *   pixels changed, default 0.1) count as identical. Exit code 1 if anything differs
 *   or is missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FIXED_TIME = '2026-10-06T09:00:00+03:00'
const TIMEZONE = 'Africa/Nairobi' // UTC+03:00, matches FIXED_TIME
const REPORT_DATE = '2026-10-04'

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

const USERS = {
  admin: 'admin@test.local',
  manager: 'manager@test.local',
  leader: 'leader@test.local',
  pastor: 'pastor@test.local',
}

const ALL_ROLES = ['loggedout', 'admin', 'manager', 'leader', 'pastor']

const REPORT_TABS = [
  ['PGA', 'pga'],
  ['4 Wk PGA', '4-wk-pga'],
  ['EPGA', 'epga'],
  ['4 Wk EPGA', '4-wk-epga'],
  ['Salvation', 'salvation'],
  ['Mechanics', 'mechanics'],
]

const LOGGED_OUT_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']

/** Routes per signed-in role (mirrors the header nav visibility in components/layout/header.tsx). */
function routesFor(role) {
  const routes = [
    '/dashboard',
    '/reports',
    `/reports/${REPORT_DATE}`,
    '/reports/2026-08-30',
    `/reports/4-week-pga/${REPORT_DATE}`,
    `/reports/4-week-epga/${REPORT_DATE}`,
    `/reports/epga/${REPORT_DATE}`,
    `/reports/salvation/${REPORT_DATE}`,
    `/reports/mechanics/${REPORT_DATE}`,
    '/reports/trends',
    '/reports/compare',
  ]
  if (role === 'admin') routes.push('/activity')
  if (['admin', 'manager', 'leader'].includes(role)) routes.push('/locations')
  if (['admin', 'manager'].includes(role)) routes.push('/team')
  routes.push('/settings/profile', '/settings/password', '/settings/appearance')
  return routes
}

const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const positional = []
  const opts = {}
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) opts[m[1]] = m[2] ?? true
    else positional.push(a)
  }
  return { positional, opts }
}

const slugify = (route) => route.replace(/^\//, '').replace(/\//g, '_') || 'root'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pool(items, concurrency, fn) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift())
  })
  await Promise.all(workers)
}

/** Wait until the page has finished loading data and painting. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  // Skeletons / spinners / busy regions must disappear
  await page
    .waitForFunction(
      () => {
        const busy = document.querySelectorAll(
          '.animate-pulse, .animate-spin, [aria-busy="true"]'
        )
        return [...busy].every((el) => {
          const r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          return r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none'
        })
      },
      null,
      { timeout: 20000, polling: 100 }
    )
    .catch(() => console.warn(`  ! loading indicators still visible on ${page.url()}`))
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  // framer-motion entrance animations (staggered cards, auth forms) run as Web
  // Animations, which the CSS freeze does not stop: wait for every finite one to end.
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          if (a.playState !== 'running' && a.playState !== 'pending') return true
          // infinite loops and scroll-driven timelines (OverlayScrollbars, endTime "100%") never end
          const end = a.effect?.getComputedTiming().endTime
          return typeof end !== 'number' || end === Infinity
        }),
      null,
      { timeout: 5000, polling: 100 }
    )
    .catch(async () => {
      const left = await page
        .evaluate(() =>
          document
            .getAnimations()
            .filter((a) => a.playState === 'running' || a.playState === 'pending')
            .map((a) => {
              const t = a.effect?.getComputedTiming()
              return `${a.playState} t=${Math.round(a.currentTime)}/${t?.endTime} ${a.effect?.target?.tagName}`
            })
        )
        .catch(() => [])
      console.warn(`  ! animations still running on ${page.url()}: ${left.slice(0, 4).join(' | ')}`)
    })
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  // Park the mouse in the top-left corner (page padding / dialog overlay) so nothing is hovered
  await page.mouse.move(0, 0)
}

/**
 * Take full-page screenshots until three consecutive ones are byte-identical, so
 * JS-driven animations (framer-motion, recharts) have finished.
 */
async function stableScreenshot(page, file) {
  let prev = null
  let same = 0
  for (let i = 0; i < 20; i++) {
    const buf = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
    same = prev && buf.equals(prev) ? same + 1 : 0
    // three identical frames in a row (~600ms without change)
    if (same >= 2) {
      fs.writeFileSync(file, buf)
      return true
    }
    prev = buf
    await sleep(300)
  }
  fs.writeFileSync(file, prev)
  console.warn(`  ! ${path.basename(file)} never stabilised; saved last frame`)
  return false
}

const CONTEXT_DEFAULTS = {
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  locale: 'en-US',
  timezoneId: TIMEZONE,
  // The production CSP only allows *.supabase.co; the local stack is http://127.0.0.1:54321.
  // CSP has no visual effect, so bypass it rather than changing app code.
  bypassCSP: true,
}

/**
 * Sign in through the real /login form and return the session (cookies) so every
 * theme/viewport variant of the role can reuse it. One login per role per run:
 * /api/auth/login is rate limited to 5 attempts per 15 min per IP (in-memory, so
 * restarting `next start` resets it).
 */
async function loginStorageState(browser, baseUrl, role) {
  const password = process.env.VS_PASSWORD || 'password123'
  const email = process.env[`VS_EMAIL_${role.toUpperCase()}`] || USERS[role]
  const context = await browser.newContext({ ...CONTEXT_DEFAULTS, viewport: VIEWPORTS.desktop })
  try {
    const page = await context.newPage()
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[autocomplete="current-password"]').fill(password)
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 30000 }),
      page.locator('form button[type="submit"]').click(),
    ])
    if (!response.ok()) {
      const body = await response.json().catch(() => ({}))
      throw new Error(
        `login as ${email} failed: HTTP ${response.status()} ${body.error || ''}` +
          (response.status() === 429 ? ' (restart `next start` or wait 15 min to reset the login rate limit)' : '')
      )
    }
    await page.waitForURL(/\/dashboard/, { timeout: 30000 })
    return await context.storageState()
  } finally {
    await context.close()
  }
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

async function runJob(browser, job, ctx) {
  const { role, theme, viewport } = job
  const { baseUrl, outDir, only, manifest, failures } = ctx
  const storageState = role === 'loggedout' ? undefined : ctx.sessions[role]
  if (role !== 'loggedout' && !storageState) return // login failed; already reported
  const context = await browser.newContext({
    ...CONTEXT_DEFAULTS,
    viewport: VIEWPORTS[viewport],
    colorScheme: theme,
    storageState,
  })
  // Theme: the app persists it via zustand (stores/use-theme-store.ts, key "theme-storage")
  await context.addInitScript(
    ({ theme, css }) => {
      try {
        localStorage.setItem('theme-storage', JSON.stringify({ state: { theme }, version: 0 }))
      } catch {}
      const inject = () => {
        if (document.getElementById('__vs_freeze')) return
        const s = document.createElement('style')
        s.id = '__vs_freeze'
        s.textContent = css
        ;(document.head || document.documentElement).appendChild(s)
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject)
      else inject()
    },
    { theme, css: FREEZE_CSS }
  )
  // Fixed "today": shift Date only, letting it tick forward from FIXED_TIME.
  // Playwright's page.clock is deliberately NOT used: install() also fakes
  // performance.now(), which keeps running across navigations while
  // document.timeline restarts at 0, so framer-motion's Web Animations get a start
  // time seconds in the future and never finish; setFixedTime() freezes Date.now(),
  // which made staggered entrance animations flaky.
  await context.addInitScript((fixed) => {
    const RealDate = Date
    const offset = fixed - RealDate.now()
    class ShiftedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(RealDate.now() + offset)
        else super(...args)
      }
      static now() {
        return RealDate.now() + offset
      }
    }
    // Date() called without new returns a string of "now"
    const DateFn = new Proxy(ShiftedDate, {
      apply: () => new ShiftedDate().toString(),
    })
    globalThis.Date = DateFn
  }, new Date(FIXED_TIME).getTime())
  const page = await context.newPage()

  const prefix = `${role}__${theme}__${viewport}__`
  const want = (slug) => !only || slug.includes(only)

  const shoot = async (route, slug, label = route) => {
    const file = `${prefix}${slug}.png`
    await settle(page)
    await stableScreenshot(page, path.join(outDir, file))
    manifest.push({ role, route: label, theme, viewport, file })
    console.log(`  ✓ ${file}`)
  }

  const step = async (slug, label, fn) => {
    if (!want(slug)) return
    try {
      await fn()
    } catch (err) {
      failures.push({ role, theme, viewport, slug, route: label, error: String(err.message || err).split('\n')[0] })
      console.warn(`  ✗ ${prefix}${slug}: ${String(err.message || err).split('\n')[0]}`)
    }
  }

  const visit = async (route) => {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
  }

  try {
    if (role === 'loggedout') {
      for (const route of LOGGED_OUT_ROUTES) {
        await step(slugify(route), route, async () => {
          await visit(route)
          await shoot(route, slugify(route))
        })
      }
      return
    }

    for (const route of routesFor(role)) {
      await step(slugify(route), route, async () => {
        await visit(route)
        await shoot(route, slugify(route))
      })

      if (route === '/reports') {
        for (const [name, tabSlug] of REPORT_TABS) {
          const slug = `reports__tab-${tabSlug}`
          await step(slug, `/reports#${tabSlug}`, async () => {
            if (!page.url().endsWith('/reports')) await visit('/reports')
            const tab = page.getByRole('tab', { name, exact: true })
            // PGA is the default tab. On mobile it is clipped off the left edge of the
            // centred, overflowing tab list (existing layout), so only click if needed.
            if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
            await shoot(route, slug, `/reports#${tabSlug}`)
          })
        }
      }
    }

    if (role === 'admin') {
      // Record PGA dialog
      await step('dashboard__record-pga-dialog', '/dashboard#record-pga', async () => {
        await visit('/dashboard')
        await settle(page)
        await page.getByRole('button', { name: 'Record PGA' }).click()
        await page.getByRole('dialog').waitFor()
        await shoot('/dashboard', 'dashboard__record-pga-dialog', '/dashboard#record-pga')
      })

      // Row-actions dropdown + edit-entry dialog on a report detail page
      await step(`reports_${REPORT_DATE}__row-menu`, `/reports/${REPORT_DATE}#row-menu`, async () => {
        await visit(`/reports/${REPORT_DATE}`)
        await settle(page)
        await page.locator('tbody button[aria-haspopup="menu"]').first().click()
        await page.getByRole('menu').waitFor()
        await shoot(`/reports/${REPORT_DATE}`, `reports_${REPORT_DATE}__row-menu`, `/reports/${REPORT_DATE}#row-menu`)
      })
      await step(`reports_${REPORT_DATE}__edit-dialog`, `/reports/${REPORT_DATE}#edit`, async () => {
        if (!(await page.getByRole('menu').isVisible().catch(() => false))) {
          await visit(`/reports/${REPORT_DATE}`)
          await settle(page)
          await page.locator('tbody button[aria-haspopup="menu"]').first().click()
        }
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        await page.getByRole('dialog').waitFor()
        await shoot(`/reports/${REPORT_DATE}`, `reports_${REPORT_DATE}__edit-dialog`, `/reports/${REPORT_DATE}#edit`)
      })

      // User menu dropdown in the header
      await step('dashboard__user-menu', '/dashboard#user-menu', async () => {
        await visit('/dashboard')
        await settle(page)
        await page.locator('header button[aria-haspopup="menu"]').last().click()
        await page.getByRole('menu').waitFor()
        await shoot('/dashboard', 'dashboard__user-menu', '/dashboard#user-menu')
      })

      // Activity: Deleted tab
      await step('activity__tab-deleted', '/activity#deleted', async () => {
        await visit('/activity')
        await settle(page)
        await page.getByRole('tab', { name: 'Deleted', exact: true }).click()
        await shoot('/activity', 'activity__tab-deleted', '/activity#deleted')
      })

      // Locations: archived toggle on
      await step('locations__archived', '/locations#archived', async () => {
        await visit('/locations')
        await settle(page)
        await page.locator('#show-archived').click()
        await shoot('/locations', 'locations__archived', '/locations#archived')
      })
    }
  } catch (err) {
    failures.push({ role, theme, viewport, slug: '*', route: '*', error: String(err.message || err).split('\n')[0] })
    console.warn(`  ✗ ${prefix}*: ${String(err.message || err).split('\n')[0]}`)
  } finally {
    await context.close()
  }
}

async function capture(positional, opts) {
  const [baseUrlArg, outDirArg] = positional
  if (!baseUrlArg || !outDirArg) {
    console.error('usage: node scripts/visual-snapshots.mjs capture <baseUrl> <outDir> [--roles=..] [--themes=..] [--viewports=..] [--only=..] [--concurrency=4]')
    process.exit(2)
  }
  const baseUrl = baseUrlArg.replace(/\/$/, '')
  const outDir = path.resolve(outDirArg)
  fs.mkdirSync(outDir, { recursive: true })

  const roles = opts.roles ? String(opts.roles).split(',') : ALL_ROLES
  const themes = opts.themes ? String(opts.themes).split(',') : ['light', 'dark']
  const viewports = opts.viewports ? String(opts.viewports).split(',') : ['desktop', 'mobile']
  const concurrency = Number(opts.concurrency || 4)

  const jobs = []
  for (const role of roles) for (const theme of themes) for (const viewport of viewports) jobs.push({ role, theme, viewport })

  const browser = await chromium.launch()
  const ctx = { baseUrl, outDir, only: opts.only ? String(opts.only) : null, manifest: [], failures: [] }
  const started = Date.now()
  ctx.sessions = {}
  for (const role of roles.filter((r) => r !== 'loggedout')) {
    try {
      ctx.sessions[role] = await loginStorageState(browser, baseUrl, role)
      console.log(`signed in as ${role}`)
    } catch (err) {
      ctx.failures.push({ role, theme: '*', viewport: '*', slug: '*', route: '/login', error: String(err.message || err) })
      console.warn(`  ✗ ${err.message || err}`)
    }
  }
  await pool(jobs, concurrency, async (job) => {
    console.log(`→ ${job.role} / ${job.theme} / ${job.viewport}`)
    await runJob(browser, job, ctx)
  })
  await browser.close()

  ctx.manifest.sort((a, b) => a.file.localeCompare(b.file))
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      { baseUrl, fixedTime: FIXED_TIME, timezone: TIMEZONE, capturedAt: new Date().toISOString(), captures: ctx.manifest, failures: ctx.failures },
      null,
      2
    )
  )
  console.log(`\n${ctx.manifest.length} captures, ${ctx.failures.length} failures in ${Math.round((Date.now() - started) / 1000)}s → ${outDir}`)
  if (ctx.failures.length) process.exitCode = 1
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

async function compare(positional, opts) {
  const [baseArg, candArg, reportArg] = positional
  if (!baseArg || !candArg || !reportArg) {
    console.error('usage: node scripts/visual-snapshots.mjs compare <baselineDir> <candidateDir> <reportDir> [--threshold=0.1]')
    process.exit(2)
  }
  const { PNG } = await import('pngjs')
  const pixelmatch = (await import('pixelmatch')).default
  const threshold = Number(opts.threshold ?? 0.1) // percent of pixels

  const baseDir = path.resolve(baseArg)
  const candDir = path.resolve(candArg)
  const reportDir = path.resolve(reportArg)
  const diffDir = path.join(reportDir, 'diffs')
  fs.mkdirSync(diffDir, { recursive: true })

  const pngs = (d) => new Set(fs.readdirSync(d).filter((f) => f.endsWith('.png')))
  const baseFiles = pngs(baseDir)
  const candFiles = pngs(candDir)
  const all = [...new Set([...baseFiles, ...candFiles])].sort()

  const results = []
  for (const file of all) {
    if (!baseFiles.has(file) || !candFiles.has(file)) {
      results.push({ file, status: baseFiles.has(file) ? 'missing-in-candidate' : 'missing-in-baseline', percent: 100 })
      continue
    }
    const a = PNG.sync.read(fs.readFileSync(path.join(baseDir, file)))
    const b = PNG.sync.read(fs.readFileSync(path.join(candDir, file)))
    // Pad both to the same size; any padding counts as changed pixels
    const width = Math.max(a.width, b.width)
    const height = Math.max(a.height, b.height)
    const pad = (img) => {
      if (img.width === width && img.height === height) return img.data
      const out = new PNG({ width, height })
      out.data.fill(0)
      PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0)
      return out.data
    }
    const diff = new PNG({ width, height })
    const changed = pixelmatch(pad(a), pad(b), diff.data, width, height, { threshold: 0.1, includeAA: false })
    const percent = (changed / (width * height)) * 100
    const sizeChanged = a.width !== b.width || a.height !== b.height
    const status = percent < threshold && !sizeChanged ? 'identical' : 'changed'
    let diffFile = null
    if (status !== 'identical' || changed > 0) {
      diffFile = `diffs/${file}`
      fs.writeFileSync(path.join(reportDir, diffFile), PNG.sync.write(diff))
    }
    results.push({
      file,
      status,
      percent: Number(percent.toFixed(4)),
      changedPixels: changed,
      baselineSize: `${a.width}x${a.height}`,
      candidateSize: `${b.width}x${b.height}`,
      diff: diffFile,
    })
  }

  results.sort((x, y) => y.percent - x.percent || x.file.localeCompare(y.file))
  const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {})
  const summary = { baselineDir: baseDir, candidateDir: candDir, thresholdPercent: threshold, total: results.length, counts, results }
  fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))

  const rel = (dir, f) => path.relative(reportDir, path.join(dir, f))
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const rows = results
    .map((r) => {
      const cls = r.status === 'identical' ? 'same' : 'diff'
      const img = (src) => (src ? `<a href="${esc(src)}" target="_blank"><img loading="lazy" src="${esc(src)}"></a>` : '<em>missing</em>')
      return `<section class="${cls}" data-status="${r.status}">
  <h2>${esc(r.file)} <span>${r.status} · ${r.percent}%${r.baselineSize && r.baselineSize !== r.candidateSize ? ` · size ${r.baselineSize} → ${r.candidateSize}` : ''}</span></h2>
  <div class="grid">
    <figure><figcaption>baseline</figcaption>${img(baseFiles.has(r.file) ? rel(baseDir, r.file) : null)}</figure>
    <figure><figcaption>candidate</figcaption>${img(candFiles.has(r.file) ? rel(candDir, r.file) : null)}</figure>
    <figure><figcaption>diff</figcaption>${img(r.diff)}</figure>
  </div>
</section>`
    })
    .join('\n')
  const html = `<!doctype html><meta charset="utf-8"><title>Visual diff</title>
<style>
body{font:14px system-ui,sans-serif;margin:16px;background:#f4f4f5;color:#18181b}
header{position:sticky;top:0;background:#f4f4f5;padding:8px 0;border-bottom:1px solid #d4d4d8;z-index:1}
section{background:#fff;border:1px solid #e4e4e7;border-radius:8px;margin:12px 0;padding:8px 12px}
section.diff{border-color:#f87171}
h2{font-size:14px;margin:4px 0 8px}h2 span{font-weight:400;color:#71717a;margin-left:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:start}
figure{margin:0}figcaption{font-size:12px;color:#71717a}img{width:100%;border:1px solid #e4e4e7}
body.hide-same section.same{display:none}
</style>
<header><strong>Visual diff</strong> — ${results.length} captures · ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')} · threshold ${threshold}% ·
<label><input type="checkbox" onchange="document.body.classList.toggle('hide-same',this.checked)" checked> hide identical</label>
<div style="font-size:12px;color:#71717a">baseline: ${esc(baseDir)}<br>candidate: ${esc(candDir)}</div></header>
<body class="hide-same">
${rows}
</body>`
  fs.writeFileSync(path.join(reportDir, 'index.html'), html)

  console.log(`${results.length} compared: ${JSON.stringify(counts)}`)
  for (const r of results.filter((r) => r.status !== 'identical').slice(0, 30)) console.log(`  ${r.percent.toFixed(3)}%  ${r.status}  ${r.file}`)
  console.log(`report: ${path.join(reportDir, 'index.html')}`)
  if (results.some((r) => r.status !== 'identical')) process.exitCode = 1
}

// ---------------------------------------------------------------------------

const [mode, ...rest] = process.argv.slice(2)
const { positional, opts } = parseArgs(rest)
if (mode === 'capture') await capture(positional, opts)
else if (mode === 'compare') await compare(positional, opts)
else {
  console.error('usage:\n  node scripts/visual-snapshots.mjs capture <baseUrl> <outDir> [options]\n  node scripts/visual-snapshots.mjs compare <baselineDir> <candidateDir> <reportDir>')
  process.exit(2)
}
