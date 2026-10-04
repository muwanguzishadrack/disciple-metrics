// Pure helpers for the Compare page: join the current and comparison period
// rows, filter, sort and total them.

import { delta, type Delta } from './periods'
import { metricValue, num, type AnyMetricKey } from './metrics'

export type GroupBy = 'location' | 'fob' | 'region' | 'total'

/** One row from rpc('get_pga_period_totals'); metric keys are read defensively */
export type PeriodTotalsRow = Record<string, unknown> & {
  group_id?: string | null
  group_name?: string | null
  fob_name?: string | null
  region_name?: string | null
  report_count?: number | null
  entry_count?: number | null
}

export interface CompareRow {
  key: string
  name: string
  fobName: string
  regionName: string
  reportCount: number
  entryCount: number
  current: PeriodTotalsRow | null
  previous: PeriodTotalsRow | null
}

function rowKey(row: PeriodTotalsRow, groupBy: GroupBy): string {
  if (groupBy === 'total') return 'total'
  return row.group_id ?? `name:${row.group_name ?? 'unknown'}`
}

/**
 * Full outer join on group id. A group present in only one period still shows
 * (e.g. a location that reported last year but not this year) with the other
 * side empty.
 */
export function mergePeriodRows(
  current: PeriodTotalsRow[],
  previous: PeriodTotalsRow[] | null,
  groupBy: GroupBy
): CompareRow[] {
  const map = new Map<string, CompareRow>()

  const upsert = (row: PeriodTotalsRow, side: 'current' | 'previous') => {
    const key = rowKey(row, groupBy)
    const existing = map.get(key)
    const base: CompareRow = existing ?? {
      key,
      name: groupBy === 'total' ? 'All locations' : row.group_name ?? 'Unknown',
      fobName: row.fob_name ?? '',
      regionName: row.region_name ?? '',
      reportCount: 0,
      entryCount: 0,
      current: null,
      previous: null,
    }
    base[side] = row
    if (side === 'current') {
      base.reportCount = num(row.report_count)
      base.entryCount = num(row.entry_count)
      // Prefer current-period naming (names can change over time)
      if (groupBy !== 'total' && row.group_name) base.name = row.group_name
      if (row.fob_name) base.fobName = row.fob_name
      if (row.region_name) base.regionName = row.region_name
    }
    map.set(key, base)
  }

  current.forEach((r) => upsert(r, 'current'))
  previous?.forEach((r) => upsert(r, 'previous'))
  return Array.from(map.values())
}

export function currentValue(row: CompareRow, key: AnyMetricKey): number {
  return metricValue(row.current, key) ?? 0
}

/** Null when there's no comparison period at all */
export function previousValue(
  row: CompareRow,
  key: AnyMetricKey,
  hasComparison: boolean
): number | null {
  if (!hasComparison) return null
  return metricValue(row.previous, key) ?? 0
}

export function rowDelta(
  row: CompareRow,
  key: AnyMetricKey,
  hasComparison: boolean
): Delta {
  return delta(currentValue(row, key), previousValue(row, key, hasComparison))
}

export function filterCompareRows(rows: CompareRow[], search: string): CompareRow[] {
  const q = search.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) =>
    [r.name, r.fobName, r.regionName].some((v) => v.toLowerCase().includes(q))
  )
}

export type SortKey =
  | { kind: 'name' }
  | { kind: 'reports' }
  | { kind: 'value'; metric: AnyMetricKey }
  | { kind: 'delta'; metric: AnyMetricKey }
  | { kind: 'pct'; metric: AnyMetricKey }

export interface SortState {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function sortCompareRows(
  rows: CompareRow[],
  sort: SortState,
  hasComparison: boolean
): CompareRow[] {
  const factor = sort.dir === 'asc' ? 1 : -1
  const k = sort.key
  const value = (r: CompareRow): number | string | null => {
    switch (k.kind) {
      case 'name':
        return r.name.toLowerCase()
      case 'reports':
        return r.reportCount
      case 'value':
        return currentValue(r, k.metric)
      case 'delta':
        return rowDelta(r, k.metric, hasComparison).abs
      case 'pct':
        return rowDelta(r, k.metric, hasComparison).pct
    }
  }
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    // Nulls (no comparison / divide by zero) always sink to the bottom
    if (va === null && vb === null) return a.name.localeCompare(b.name)
    if (va === null) return 1
    if (vb === null) return -1
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * factor
    }
    const diff = ((va as number) - (vb as number)) * factor
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })
}

export interface CompareTotals {
  current: Record<string, number>
  previous: Record<string, number> | null
  entryCount: number
}

/** Sum the visible rows for the totals row */
export function totalCompareRows(
  rows: CompareRow[],
  metrics: AnyMetricKey[],
  hasComparison: boolean
): CompareTotals {
  const current: Record<string, number> = {}
  const previous: Record<string, number> | null = hasComparison ? {} : null
  for (const m of metrics) {
    current[m] = rows.reduce((acc, r) => acc + currentValue(r, m), 0)
    if (previous) {
      previous[m] = rows.reduce((acc, r) => acc + (previousValue(r, m, true) ?? 0), 0)
    }
  }
  return {
    current,
    previous,
    entryCount: rows.reduce((acc, r) => acc + r.entryCount, 0),
  }
}
