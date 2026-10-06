#!/usr/bin/env node
// Prints the first-load client JS per App Router page (gzip KB), read from the
// manifests of the last `next build`. Next 16 no longer prints route sizes.
//
//   node scripts/route-js-size.mjs           # table
//   node scripts/route-js-size.mjs --json    # { route: gzipKB }
//
// First load = the root main files (framework, runtime) + every chunk listed in
// the page's client reference manifest `entryJSFiles` (root layout, group
// layouts and the page itself). Chunks loaded later via dynamic import() are
// not counted, which is the point: they only download on interaction.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = process.cwd()
const nextDir = join(root, '.next')
const appDir = join(nextDir, 'server', 'app')
const buildManifest = JSON.parse(readFileSync(join(nextDir, 'build-manifest.json'), 'utf8'))
const rootMain = buildManifest.rootMainFiles ?? []

const gzCache = new Map()
function gzipBytes(file) {
  if (!gzCache.has(file)) {
    gzCache.set(file, gzipSync(readFileSync(join(nextDir, file)), { level: 9 }).length)
  }
  return gzCache.get(file)
}

function findManifests(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...findManifests(full))
    else if (name === 'page_client-reference-manifest.js') out.push(full)
  }
  return out
}

function toRoute(file) {
  const rel = relative(appDir, file).split(sep).slice(0, -1)
  const segments = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')))
  return '/' + segments.join('/')
}

const rows = []
for (const file of findManifests(appDir)) {
  const route = toRoute(file)
  if (route.startsWith('/_')) continue
  globalThis.__RSC_MANIFEST = {}
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(file, 'utf8'))()
  const manifest = Object.values(globalThis.__RSC_MANIFEST)[0]
  const files = new Set(rootMain)
  for (const list of Object.values(manifest.entryJSFiles ?? {})) {
    for (const f of list) files.add(f.replace(/^\/?_next\//, ''))
  }
  let bytes = 0
  for (const f of files) bytes += gzipBytes(f)
  rows.push({ route, kb: Math.round((bytes / 1024) * 10) / 10, chunks: files.size })
}
rows.sort((a, b) => a.route.localeCompare(b.route))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(Object.fromEntries(rows.map((r) => [r.route, r.kb])), null, 2))
} else {
  const w = Math.max(...rows.map((r) => r.route.length))
  console.log(`${'Route'.padEnd(w)}  First-load JS (gzip KB)  Chunks`)
  for (const r of rows) {
    console.log(`${r.route.padEnd(w)}  ${String(r.kb).padStart(22)}  ${String(r.chunks).padStart(6)}`)
  }
}
