import { describe, it, expect } from 'vitest'
import {
  filterCompareRows,
  mergePeriodRows,
  rowDelta,
  sortCompareRows,
  totalCompareRows,
  type PeriodTotalsRow,
} from '@/components/analytics/compare'
import { availableMetrics, metricValue, num } from '@/components/analytics/metrics'
import { diffMetricFields, operationLabel } from '@/components/activity/diff'
import {
  describeRpcError,
  isMissingRpcError,
  isPermissionError,
  shouldRetryRpc,
} from '@/components/analytics/rpc-errors'

const loc = (id: string, name: string, extra: Partial<PeriodTotalsRow> = {}): PeriodTotalsRow => ({
  group_id: id,
  group_name: name,
  fob_name: 'FOB A',
  region_name: 'Region 1',
  report_count: 4,
  entry_count: 4,
  sv1: 10,
  sv2: 5,
  yxp: 0,
  kids: 2,
  local: 0,
  hc1: 1,
  hc2: 1,
  salvations: 3,
  ...extra,
})

describe('metrics', () => {
  it('coerces RPC values', () => {
    expect(num('12')).toBe(12)
    expect(num(null)).toBe(0)
    expect(num(undefined)).toBe(0)
    expect(num('abc')).toBe(0)
  })

  it('derives totals and returns null for absent columns', () => {
    const row = loc('a', 'A')
    expect(metricValue(row, 'pga_total')).toBe(19)
    expect(metricValue(row, 'epga_total')).toBe(15)
    expect(metricValue(row, 'salvations')).toBe(3)
    expect(metricValue(row, 'mechanics_training')).toBeNull()
  })

  it('hides metrics no row carries', () => {
    expect(availableMetrics([loc('a', 'A')], ['pga_total', 'salvations', 'mechanics_training'])).toEqual([
      'pga_total',
      'salvations',
    ])
  })
})

describe('mergePeriodRows', () => {
  it('full-outer-joins current and previous on group id', () => {
    const rows = mergePeriodRows(
      [loc('a', 'Alpha'), loc('b', 'Bravo')],
      [loc('a', 'Alpha', { salvations: 1 }), loc('c', 'Charlie', { salvations: 7 })],
      'location'
    )
    expect(rows.map((r) => r.key).sort()).toEqual(['a', 'b', 'c'])
    const c = rows.find((r) => r.key === 'c')!
    expect(c.current).toBeNull()
    expect(c.name).toBe('Charlie')
    expect(rowDelta(c, 'salvations', true)).toEqual({ abs: -7, pct: -1 })

    const a = rows.find((r) => r.key === 'a')!
    expect(rowDelta(a, 'salvations', true)).toEqual({ abs: 2, pct: 2 })

    const b = rows.find((r) => r.key === 'b')!
    expect(rowDelta(b, 'salvations', true)).toEqual({ abs: 3, pct: null })
  })

  it('collapses total grouping to one row', () => {
    const rows = mergePeriodRows(
      [{ group_id: null, group_name: null, salvations: 10 }],
      [{ group_id: null, group_name: null, salvations: 5 }],
      'total'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('All locations')
  })

  it('has no delta without a comparison period', () => {
    const [row] = mergePeriodRows([loc('a', 'A')], null, 'location')
    expect(rowDelta(row, 'salvations', false)).toEqual({ abs: null, pct: null })
  })
})

describe('filter / sort / totals', () => {
  const rows = mergePeriodRows(
    [loc('a', 'Alpha', { salvations: 5 }), loc('b', 'Bravo', { salvations: 9, fob_name: 'FOB B' }), loc('c', 'Charlie', { salvations: 1 })],
    [loc('a', 'Alpha', { salvations: 10 }), loc('b', 'Bravo', { salvations: 3 })],
    'location'
  )

  it('searches name, FOB and region', () => {
    expect(filterCompareRows(rows, 'brav').map((r) => r.key)).toEqual(['b'])
    expect(filterCompareRows(rows, 'fob b').map((r) => r.key)).toEqual(['b'])
    expect(filterCompareRows(rows, '  ')).toHaveLength(3)
  })

  it('sorts by value, delta and name', () => {
    const byValue = sortCompareRows(rows, { key: { kind: 'value', metric: 'salvations' }, dir: 'desc' }, true)
    expect(byValue.map((r) => r.key)).toEqual(['b', 'a', 'c'])

    const byDelta = sortCompareRows(rows, { key: { kind: 'delta', metric: 'salvations' }, dir: 'asc' }, true)
    expect(byDelta.map((r) => r.key)).toEqual(['a', 'c', 'b'])

    const byName = sortCompareRows(rows, { key: { kind: 'name' }, dir: 'desc' }, true)
    expect(byName.map((r) => r.key)).toEqual(['c', 'b', 'a'])
  })

  it('sinks null percentages regardless of direction', () => {
    const asc = sortCompareRows(rows, { key: { kind: 'pct', metric: 'salvations' }, dir: 'asc' }, true)
    expect(asc[asc.length - 1].key).toBe('c')
    const desc = sortCompareRows(rows, { key: { kind: 'pct', metric: 'salvations' }, dir: 'desc' }, true)
    expect(desc[desc.length - 1].key).toBe('c')
  })

  it('totals visible rows', () => {
    const totals = totalCompareRows(rows, ['salvations'], true)
    expect(totals.current.salvations).toBe(15)
    expect(totals.previous?.salvations).toBe(13)
    expect(totalCompareRows(rows, ['salvations'], false).previous).toBeNull()
  })
})

describe('diffMetricFields', () => {
  it('lists only changed metric fields on UPDATE', () => {
    const changes = diffMetricFields(
      'UPDATE',
      { sv1: 10, sv2: 5, updated_at: 'x', salvations_mc: 1 },
      { sv1: 12, sv2: 5, updated_at: 'y', salvations_mc: null }
    )
    expect(changes).toEqual([
      { field: 'sv1', label: '1st service', old: 10, new: 12 },
      { field: 'salvations_mc', label: 'Salvations – MC', old: 1, new: null },
    ])
  })

  it('shows non-empty values on INSERT/RESTORE and DELETE', () => {
    expect(diffMetricFields('INSERT', null, { sv1: 3, sv2: 0, kids: null })).toEqual([
      { field: 'sv1', label: '1st service', old: null, new: 3 },
    ])
    expect(diffMetricFields('RESTORE', null, { baptisms: '2' })).toEqual([
      { field: 'baptisms', label: 'Baptisms', old: null, new: 2 },
    ])
    expect(diffMetricFields('DELETE', { mca: 4, hc1: 0 }, null)).toEqual([
      { field: 'mca', label: 'MCA', old: 4, new: null },
    ])
  })

  it('ignores report rows with no metric columns', () => {
    expect(diffMetricFields('UPDATE', { date: '2026-01-04' }, { date: '2026-01-11' })).toEqual([])
  })

  it('labels operations', () => {
    expect(operationLabel('UPDATE')).toBe('Edited')
    expect(operationLabel('WHATEVER')).toBe('WHATEVER')
  })
})

describe('rpc errors', () => {
  it('detects a not-yet-deployed RPC', () => {
    expect(isMissingRpcError({ code: 'PGRST202', message: 'Could not find the function public.get_pga_trend' })).toBe(true)
    expect(isMissingRpcError({ code: '42883' })).toBe(true)
    expect(isMissingRpcError({ code: '23514' })).toBe(false)
    expect(isMissingRpcError(null)).toBe(false)
  })

  it('detects permission errors', () => {
    expect(isPermissionError({ code: '42501' })).toBe(true)
    expect(isPermissionError({ message: 'Only admins only may do this' })).toBe(true)
    expect(isPermissionError({ message: 'Administrator note' })).toBe(false)
  })

  it('describes errors and does not retry hopeless ones', () => {
    expect(describeRpcError({ code: 'PGRST202' }, 'Trends')).toMatch(/Trends isn't available yet/)
    expect(describeRpcError({ message: 'boom' })).toBe('boom')
    expect(shouldRetryRpc(0, { code: 'PGRST202' })).toBe(false)
    expect(shouldRetryRpc(0, { code: '500' })).toBe(true)
    expect(shouldRetryRpc(2, { code: '500' })).toBe(false)
  })
})
